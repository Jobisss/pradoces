'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { ultimasCompras } from '@/lib/custo/corrente'
import { computeLoteSnapshot } from '@/lib/custo/congelado'
import { ProduzirLoteSchema } from '@/lib/validation/lotes'

/**
 * Produção de lote (LOTE-01..04), admin-only — o coração da fase. O custo é
 * SEMPRE recomputado server-side dentro da transação, a partir das compras
 * FK'adas: o client manda só {ingredienteCompraId, qtde}, nunca custo. A
 * qtde do client é só conferida por igualdade contra receita×multiplicador
 * (dados desatualizados na tela do usuário) — nunca usada pra calcular.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const DADOS_DESATUALIZADOS = 'Os dados mudaram — recarrega a página e tenta de novo.'

export type LoteActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
  custoTotal?: string
  custoPorUnidade?: string
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const ua = h.get('user-agent') ?? undefined
  return { ip, ua }
}

export async function produzirLote(input: unknown): Promise<LoteActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ProduzirLoteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  type TxResult = {
    loteId: string
    custoTotalCongelado: string
    custoPorUnidadeCongelado: string
  }

  let result: TxResult
  try {
    result = await prisma.$transaction(async (tx) => {
      const receita = await tx.receita.findUniqueOrThrow({
        where: { id: data.receitaId },
        include: { itens: true },
      })

      const compras = await tx.ingredienteCompra.findMany({
        where: { id: { in: data.linhas.map((l) => l.ingredienteCompraId) } },
      })
      if (compras.length !== data.linhas.length) throw new Error('DADOS_DESATUALIZADOS')

      const compraPorIngrediente = new Map(compras.map((c) => [c.ingredienteId, c]))
      const ingredientesReceita = new Set(receita.itens.map((i) => i.ingredienteId))
      const ingredientesCompras = new Set(compras.map((c) => c.ingredienteId))
      const cobreTodos =
        ingredientesReceita.size === ingredientesCompras.size &&
        [...ingredientesReceita].every((id) => ingredientesCompras.has(id))
      if (!cobreTodos) throw new Error('DADOS_DESATUALIZADOS')

      const linhasSnapshot = receita.itens.map((item) => {
        const compra = compraPorIngrediente.get(item.ingredienteId)!
        const linhaClient = data.linhas.find((l) => l.ingredienteCompraId === compra.id)
        const qtdeUsadaServer = new Decimal(item.qtde).times(data.multiplicador)
        if (!linhaClient || linhaClient.qtde.toFixed(3) !== qtdeUsadaServer.toFixed(3)) {
          throw new Error('DADOS_DESATUALIZADOS')
        }
        return {
          compra: {
            id: compra.id,
            marca: compra.marca,
            custoPorUnidadeBase: new Decimal(compra.custoPorUnidadeBase),
          },
          qtdeUsada: qtdeUsadaServer,
        }
      })

      const snapshot = computeLoteSnapshot({
        linhas: linhasSnapshot,
        custoGas: receita.custoGas ? new Decimal(receita.custoGas) : new Decimal(0),
        rendimentoReal: data.rendimentoReal,
      })

      const lote = await tx.lote.create({
        data: {
          produtoId: data.produtoId,
          receitaId: data.receitaId,
          multiplicador: data.multiplicador.toFixed(2),
          rendimentoReal: data.rendimentoReal,
          validade: new Date(`${data.validade}T00:00:00Z`),
          qtdeDisponivel: data.rendimentoReal,
          qtdeReservada: 0,
          custoGasCongelado: snapshot.custoGasCongelado,
          custoTotalCongelado: snapshot.custoTotalCongelado,
          custoPorUnidadeCongelado: snapshot.custoPorUnidadeCongelado,
          usos: { create: snapshot.usos },
        },
      })

      return {
        loteId: lote.id,
        custoTotalCongelado: snapshot.custoTotalCongelado,
        custoPorUnidadeCongelado: snapshot.custoPorUnidadeCongelado,
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'DADOS_DESATUALIZADOS') {
      return { error: DADOS_DESATUALIZADOS }
    }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'lote_criado',
    entityType: 'lote',
    entityId: result.loteId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/lotes')
  return {
    ok: true,
    id: result.loteId,
    custoTotal: result.custoTotalCongelado,
    custoPorUnidade: result.custoPorUnidadeCongelado,
  }
}

export type DadosProducao = {
  receita: {
    id: string
    nome: string
    rendimentoPadrao: number
    validadeDias: number | null
    custoGas: string | null
  }
  linhas: Array<{
    ingredienteId: string
    nome: string
    unidadeBase: string
    qtdeBase: string
    compraSelecionada: { id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string } | null
  }>
}

/** D-05 — dados pra montar o form de produção, com a última compra pré-selecionada por ingrediente. */
export async function dadosProducao(receitaId: string): Promise<DadosProducao | null> {
  try {
    await requireAdmin()
  } catch {
    return null
  }
  try {
    const receita = await prisma.receita.findUnique({
      where: { id: receitaId },
      include: { itens: { include: { ingrediente: true } } },
    })
    if (!receita) return null

    const ultimas = await ultimasCompras(receita.itens.map((item) => item.ingredienteId))

    return {
      receita: {
        id: receita.id,
        nome: receita.nome,
        rendimentoPadrao: receita.rendimentoPadrao,
        validadeDias: receita.validadeDias,
        custoGas: receita.custoGas ? receita.custoGas.toFixed(4) : null,
      },
      linhas: receita.itens.map((item) => {
        const ultima = ultimas.get(item.ingredienteId)
        return {
          ingredienteId: item.ingredienteId,
          nome: item.ingrediente.nome,
          unidadeBase: item.ingrediente.unidadeBase,
          qtdeBase: item.qtde.toFixed(3),
          compraSelecionada: ultima
            ? {
                id: ultima.id,
                marca: ultima.marca,
                dataCompra: ultima.dataCompra.toISOString().slice(0, 10),
                custoPorUnidadeBase: ultima.custoPorUnidadeBase.toFixed(6),
              }
            : null,
        }
      }),
    }
  } catch {
    return null
  }
}

/** D-05 — "Trocar compra": últimas compras desse ingrediente, mais recente primeiro. */
export async function comprasDoIngrediente(
  ingredienteId: string,
): Promise<Array<{ id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string }>> {
  try {
    await requireAdmin()
  } catch {
    return []
  }
  try {
    const compras = await prisma.ingredienteCompra.findMany({
      where: { ingredienteId },
      orderBy: [{ dataCompra: 'desc' }, { criadoEm: 'desc' }],
      take: 20,
    })
    return compras.map((c) => ({
      id: c.id,
      marca: c.marca,
      dataCompra: c.dataCompra.toISOString().slice(0, 10),
      custoPorUnidadeBase: c.custoPorUnidadeBase.toFixed(6),
    }))
  } catch {
    return []
  }
}
