'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { ultimasCompras, pesoTotalGramasReceita } from '@/lib/custo/corrente'
import { computeLoteSnapshot } from '@/lib/custo/congelado'
import { ProduzirLoteSchema } from '@/lib/validation/lotes'

/**
 * Produção de lote (LOTE-01..04), admin-only — o coração da fase. O custo é
 * SEMPRE recomputado server-side dentro da transação, a partir das compras
 * FK'adas: o client manda só {ingredienteCompraId, qtde}, nunca custo. A
 * qtde do client é só conferida por igualdade contra o requerido (nunca
 * usada pra calcular).
 *
 * D-12 (recheio): quando o produto tem `recheioReceitaId`, os ingredientes
 * da receita de recheio entram na MESMA transação/snapshot que a base, mas
 * escalam por um eixo DIFERENTE — base escala pelo multiplicador (D-07,
 * quantas receitas foram feitas), recheio escala por
 * (recheioGramasUsadas ÷ peso total em gramas da receita de recheio) ×
 * rendimentoReal — a receita de recheio é tratada como um LOTE (ex.: uma
 * receita inteira de brigadeiro), rateada por regra de 3 pra dose que cada
 * unidade final leva (ver lib/custo/corrente.ts:custoCorrenteRecheio).
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
      const produto = await tx.produto.findUniqueOrThrow({ where: { id: data.produtoId } })
      const receita = await tx.receita.findUniqueOrThrow({
        where: { id: data.receitaId },
        include: { itens: true },
      })
      const recheioReceita = produto.recheioReceitaId
        ? await tx.receita.findUniqueOrThrow({
            where: { id: produto.recheioReceitaId },
            include: { itens: { include: { ingrediente: true } } },
          })
        : null

      // Regra de 3: fração da receita de recheio (tratada como um LOTE, ex.:
      // uma receita inteira de brigadeiro) que 1 unidade final consome.
      let fracaoRecheio = new Decimal(0)
      if (recheioReceita) {
        if (!produto.recheioGramasUsadas) throw new Error('RECHEIO_SEM_CONFIG')
        const { pesoTotalG } = pesoTotalGramasReceita(recheioReceita.itens)
        if (pesoTotalG.isZero()) throw new Error('RECHEIO_SEM_CONFIG')
        fracaoRecheio = new Decimal(produto.recheioGramasUsadas).dividedBy(pesoTotalG)
      }

      const compras = await tx.ingredienteCompra.findMany({
        where: { id: { in: data.linhas.map((l) => l.ingredienteCompraId) } },
      })
      const compraPorIngrediente = new Map(compras.map((c) => [c.ingredienteId, c]))

      type Requerido = { ingredienteId: string; qtdeBase: Decimal; escalaPor: 'multiplicador' | 'rendimentoReal' }
      const requeridos: Requerido[] = [
        ...receita.itens.map((item) => ({
          ingredienteId: item.ingredienteId,
          qtdeBase: new Decimal(item.qtde),
          escalaPor: 'multiplicador' as const,
        })),
        ...(recheioReceita?.itens.map((item) => ({
          ingredienteId: item.ingredienteId,
          qtdeBase: new Decimal(item.qtde).times(fracaoRecheio),
          escalaPor: 'rendimentoReal' as const,
        })) ?? []),
      ]

      // Pool de linhas do client — cada item requerido CONSOME uma linha (por
      // compra id + qtde exata), nunca reaproveita a mesma pra dois itens.
      // Isso permite base e recheio precisarem do MESMO ingrediente sem que
      // um "roube" a linha do outro (ex.: os dois usam açúcar).
      const linhasDisponiveis = [...data.linhas]

      const linhasSnapshot = requeridos.map((req) => {
        const compra = compraPorIngrediente.get(req.ingredienteId)
        if (!compra) throw new Error('DADOS_DESATUALIZADOS')
        const qtdeUsadaServer =
          req.escalaPor === 'multiplicador'
            ? req.qtdeBase.times(data.multiplicador)
            : req.qtdeBase.times(data.rendimentoReal)
        const idx = linhasDisponiveis.findIndex(
          (l) => l.ingredienteCompraId === compra.id && l.qtde.toFixed(3) === qtdeUsadaServer.toFixed(3),
        )
        if (idx === -1) throw new Error('DADOS_DESATUALIZADOS')
        linhasDisponiveis.splice(idx, 1)
        return {
          compra: {
            id: compra.id,
            marca: compra.marca,
            custoPorUnidadeBase: new Decimal(compra.custoPorUnidadeBase),
          },
          qtdeUsada: qtdeUsadaServer,
        }
      })

      const custoGasTotal = (receita.custoGas ? new Decimal(receita.custoGas) : new Decimal(0)).plus(
        recheioReceita?.custoGas ? new Decimal(recheioReceita.custoGas) : new Decimal(0),
      )

      const snapshot = computeLoteSnapshot({
        linhas: linhasSnapshot,
        custoGas: custoGasTotal,
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
    if (err instanceof Error && err.message === 'RECHEIO_SEM_CONFIG') {
      return { error: 'Esse produto tem recheio mas falta configurar quantas gramas — edita o produto antes.' }
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
  recheio: { id: string; nome: string; gramasUsadas: string; pesoTotalG: string } | null
  linhas: Array<{
    ingredienteId: string
    nome: string
    unidadeBase: string
    qtdeBase: string
    origem: 'base' | 'recheio'
    compraSelecionada: { id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string } | null
  }>
}

/**
 * D-05 — dados pra montar o form de produção, com a última compra
 * pré-selecionada por ingrediente. Recebe o PRODUTO (não a receita direto)
 * porque precisa saber se ele tem recheio anexo (D-12).
 */
export async function dadosProducao(produtoId: string): Promise<DadosProducao | null> {
  try {
    await requireAdmin()
  } catch {
    return null
  }
  try {
    const produto = await prisma.produto.findUnique({ where: { id: produtoId } })
    if (!produto?.receitaId) return null

    const receita = await prisma.receita.findUnique({
      where: { id: produto.receitaId },
      include: { itens: { include: { ingrediente: true } } },
    })
    if (!receita) return null

    const recheioReceita = produto.recheioReceitaId
      ? await prisma.receita.findUnique({
          where: { id: produto.recheioReceitaId },
          include: { itens: { include: { ingrediente: true } } },
        })
      : null

    const todosIngredienteIds = [
      ...receita.itens.map((item) => item.ingredienteId),
      ...(recheioReceita?.itens.map((item) => item.ingredienteId) ?? []),
    ]
    const ultimas = await ultimasCompras(todosIngredienteIds)

    function serializarLinha(
      item: { ingredienteId: string; qtde: Decimal; ingrediente: { nome: string; unidadeBase: string } },
      origem: 'base' | 'recheio',
    ) {
      const ultima = ultimas.get(item.ingredienteId)
      return {
        ingredienteId: item.ingredienteId,
        nome: item.ingrediente.nome,
        unidadeBase: item.ingrediente.unidadeBase,
        qtdeBase: item.qtde.toFixed(3),
        origem,
        compraSelecionada: ultima
          ? {
              id: ultima.id,
              marca: ultima.marca,
              dataCompra: ultima.dataCompra.toISOString().slice(0, 10),
              custoPorUnidadeBase: ultima.custoPorUnidadeBase.toFixed(6),
            }
          : null,
      }
    }

    return {
      receita: {
        id: receita.id,
        nome: receita.nome,
        rendimentoPadrao: receita.rendimentoPadrao,
        validadeDias: receita.validadeDias,
        custoGas: receita.custoGas ? receita.custoGas.toFixed(4) : null,
      },
      recheio: recheioReceita
        ? {
            id: recheioReceita.id,
            nome: recheioReceita.nome,
            gramasUsadas: produto.recheioGramasUsadas ? produto.recheioGramasUsadas.toFixed(3) : '0',
            pesoTotalG: pesoTotalGramasReceita(recheioReceita.itens).pesoTotalG.toFixed(3),
          }
        : null,
      linhas: [
        ...receita.itens.map((item) => serializarLinha(item, 'base')),
        ...(recheioReceita?.itens.map((item) => serializarLinha(item, 'recheio')) ?? []),
      ],
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
