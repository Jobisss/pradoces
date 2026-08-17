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
import { ProduzirLotesSchema, BaixarLoteSchema } from '@/lib/validation/lotes'

/**
 * Produção de lote (LOTE-01..04), admin-only — o coração da fase. O custo é
 * SEMPRE recomputado server-side dentro da transação, a partir das compras
 * FK'adas: o client manda só {ingredienteCompraId, qtde}, nunca custo. A
 * qtde do client é só conferida por igualdade contra o requerido (nunca
 * usada pra calcular).
 *
 * D-13 (variação): uma fornada da receita base pode virar lotes de VÁRIAS
 * variações numa transação só ("fiz 5 desse, 3 desse"). Os ingredientes da
 * BASE são comprados uma vez pra fornada inteira, então o custo deles é
 * FATIADO proporcionalmente entre os lotes por
 * `rendimentoReal_i / Σ rendimentoReal` — é a única divisão que não distorce
 * o custo real de cada lote. O recheio de cada variação (quando houver)
 * continua tratado como um LOTE inteiro rateado por regra de 3
 * (recheioGramasUsadas ÷ peso total da receita de recheio) × rendimentoReal
 * daquela variação — sem fatiar entre lotes, porque já é per-variação.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const DADOS_DESATUALIZADOS = 'Os dados mudaram — recarrega a página e tenta de novo.'
const RECHEIO_SEM_CONFIG_COPY =
  'Uma das variações tem recheio mas falta configurar quantas gramas — edita o produto antes.'

export type LotesActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  lotes?: Array<{ id: string; variacaoId: string; custoTotal: string; custoPorUnidade: string }>
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const ua = h.get('user-agent') ?? undefined
  return { ip, ua }
}

type LinhaCompra = { compra: { id: string; marca: string; custoPorUnidadeBase: Decimal }; qtdeUsada: Decimal }

export async function produzirLotes(input: unknown): Promise<LotesActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ProduzirLotesSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  type LoteResult = { loteId: string; variacaoId: string; custoTotalCongelado: string; custoPorUnidadeCongelado: string }

  let resultados: LoteResult[]
  try {
    resultados = await prisma.$transaction(async (tx) => {
      const receita = await tx.receita.findUniqueOrThrow({ where: { id: data.receitaId }, include: { itens: true } })

      const variacoes = await tx.variacao.findMany({
        where: { id: { in: data.variacoes.map((v) => v.variacaoId) } },
        include: { receitaRecheio: { include: { itens: { include: { ingrediente: true } } } } },
      })
      const variacaoPorId = new Map(variacoes.map((v) => [v.id, v]))
      if (variacoes.length !== new Set(data.variacoes.map((v) => v.variacaoId)).size) {
        throw new Error('DADOS_DESATUALIZADOS')
      }

      // Base da fornada inteira — mesma checagem exata de sempre (qtde do
      // client tem que bater com item.qtde × multiplicador).
      const comprasBase = await tx.ingredienteCompra.findMany({
        where: { id: { in: data.linhasBase.map((l) => l.ingredienteCompraId) } },
      })
      const compraBasePorIngrediente = new Map(comprasBase.map((c) => [c.ingredienteId, c]))
      const linhasBaseDisponiveis = [...data.linhasBase]

      const basePorIngrediente = new Map<string, LinhaCompra>()
      for (const item of receita.itens) {
        const compra = compraBasePorIngrediente.get(item.ingredienteId)
        if (!compra) throw new Error('DADOS_DESATUALIZADOS')
        const qtdeUsadaServer = new Decimal(item.qtde).times(data.multiplicador)
        const idx = linhasBaseDisponiveis.findIndex(
          (l) => l.ingredienteCompraId === compra.id && l.qtde.toFixed(3) === qtdeUsadaServer.toFixed(3),
        )
        if (idx === -1) throw new Error('DADOS_DESATUALIZADOS')
        linhasBaseDisponiveis.splice(idx, 1)
        basePorIngrediente.set(item.ingredienteId, {
          compra: { id: compra.id, marca: compra.marca, custoPorUnidadeBase: new Decimal(compra.custoPorUnidadeBase) },
          qtdeUsada: qtdeUsadaServer,
        })
      }
      if (linhasBaseDisponiveis.length > 0) throw new Error('DADOS_DESATUALIZADOS')

      const somaRendimento = data.variacoes.reduce((soma, v) => soma + v.rendimentoReal, 0)
      const custoGasBase = receita.custoGas ? new Decimal(receita.custoGas) : new Decimal(0)

      const resultados: LoteResult[] = []
      for (const item of data.variacoes) {
        const variacao = variacaoPorId.get(item.variacaoId)
        if (!variacao) throw new Error('DADOS_DESATUALIZADOS')
        const fracao = new Decimal(item.rendimentoReal).dividedBy(somaRendimento)

        // Fatia da base pra ESSE lote — os ingredientes da massa foram
        // comprados uma vez pra fornada inteira, cada lote leva sua parte
        // proporcional ao que rendeu.
        const linhasBaseFatia: LinhaCompra[] = [...basePorIngrediente.values()].map((b) => ({
          compra: b.compra,
          qtdeUsada: b.qtdeUsada.times(fracao),
        }))

        // Recheio dessa variação (se houver) — regra de 3, INTEIRO nesse
        // lote (já é per-variação, não precisa fatiar de novo).
        let linhasRecheio: LinhaCompra[] = []
        let custoGasRecheio = new Decimal(0)
        if (variacao.receitaRecheio) {
          if (!variacao.recheioGramasUsadas) throw new Error('RECHEIO_SEM_CONFIG')
          const { pesoTotalG } = pesoTotalGramasReceita(variacao.receitaRecheio.itens)
          if (pesoTotalG.isZero()) throw new Error('RECHEIO_SEM_CONFIG')
          const fracaoRecheio = new Decimal(variacao.recheioGramasUsadas).dividedBy(pesoTotalG)

          const comprasRecheio = await tx.ingredienteCompra.findMany({
            where: { id: { in: item.linhasRecheio.map((l) => l.ingredienteCompraId) } },
          })
          const compraRecheioPorIngrediente = new Map(comprasRecheio.map((c) => [c.ingredienteId, c]))
          const linhasRecheioDisponiveis = [...item.linhasRecheio]

          linhasRecheio = variacao.receitaRecheio.itens.map((ri) => {
            const compra = compraRecheioPorIngrediente.get(ri.ingredienteId)
            if (!compra) throw new Error('DADOS_DESATUALIZADOS')
            const qtdeUsadaServer = new Decimal(ri.qtde).times(fracaoRecheio).times(item.rendimentoReal)
            const idx = linhasRecheioDisponiveis.findIndex(
              (l) => l.ingredienteCompraId === compra.id && l.qtde.toFixed(3) === qtdeUsadaServer.toFixed(3),
            )
            if (idx === -1) throw new Error('DADOS_DESATUALIZADOS')
            linhasRecheioDisponiveis.splice(idx, 1)
            return {
              compra: { id: compra.id, marca: compra.marca, custoPorUnidadeBase: new Decimal(compra.custoPorUnidadeBase) },
              qtdeUsada: qtdeUsadaServer,
            }
          })
          if (linhasRecheioDisponiveis.length > 0) throw new Error('DADOS_DESATUALIZADOS')
          custoGasRecheio = variacao.receitaRecheio.custoGas ? new Decimal(variacao.receitaRecheio.custoGas) : new Decimal(0)
        } else if (item.linhasRecheio.length > 0) {
          throw new Error('DADOS_DESATUALIZADOS')
        }

        const custoGasLote = custoGasBase.times(fracao).plus(custoGasRecheio)

        const snapshot = computeLoteSnapshot({
          linhas: [...linhasBaseFatia, ...linhasRecheio],
          custoGas: custoGasLote,
          rendimentoReal: item.rendimentoReal,
        })

        const lote = await tx.lote.create({
          data: {
            produtoId: data.produtoId,
            variacaoId: variacao.id,
            receitaId: data.receitaId,
            multiplicador: data.multiplicador.times(fracao).toFixed(2),
            rendimentoReal: item.rendimentoReal,
            validade: new Date(`${data.validade}T00:00:00Z`),
            qtdeDisponivel: item.rendimentoReal,
            qtdeReservada: 0,
            custoGasCongelado: snapshot.custoGasCongelado,
            custoTotalCongelado: snapshot.custoTotalCongelado,
            custoPorUnidadeCongelado: snapshot.custoPorUnidadeCongelado,
            usos: { create: snapshot.usos },
          },
        })

        resultados.push({
          loteId: lote.id,
          variacaoId: variacao.id,
          custoTotalCongelado: snapshot.custoTotalCongelado,
          custoPorUnidadeCongelado: snapshot.custoPorUnidadeCongelado,
        })
      }

      return resultados
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'DADOS_DESATUALIZADOS') {
      return { error: DADOS_DESATUALIZADOS }
    }
    if (err instanceof Error && err.message === 'RECHEIO_SEM_CONFIG') {
      return { error: RECHEIO_SEM_CONFIG_COPY }
    }
    return { error: GENERIC_SERVER_ERROR }
  }

  for (const r of resultados) {
    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      action: 'lote_criado',
      entityType: 'lote',
      entityId: r.loteId,
      metadata: { variacaoId: r.variacaoId },
      rawIp: ip,
      rawUa: ua,
    })
  }

  revalidatePath('/admin/lotes')
  return {
    ok: true,
    lotes: resultados.map((r) => ({
      id: r.loteId,
      variacaoId: r.variacaoId,
      custoTotal: r.custoTotalCongelado,
      custoPorUnidade: r.custoPorUnidadeCongelado,
    })),
  }
}

class LoteBaixaError extends Error {}

const LOTE_NAO_ENCONTRADO = 'Lote não encontrado — recarrega a página.'

/**
 * Baixa manual de estoque SEM venda — lote venceu antes de vender tudo, ou
 * estragou/danificou. Reduz qtde_disponivel igual uma confirmação de reserva
 * reduziria, mas sem criar Reserva/ReservaItem (não é receita). Só as
 * unidades LIVRES (qtdeDisponivel − qtdeReservada) podem ser baixadas —
 * nunca as que já estão em soft-hold de uma reserva pendente de outro
 * cliente. O CHECK `lotes_reservada_nao_excede_disponivel` já existente é a
 * defesa final contra essa mesma invariante.
 */
export async function darBaixaLote(input: unknown): Promise<LotesActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = BaixarLoteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.lote.findUnique({
        where: { id: data.loteId },
        select: { qtdeDisponivel: true, qtdeReservada: true },
      })
      if (!lote) throw new LoteBaixaError(LOTE_NAO_ENCONTRADO)

      const livre = lote.qtdeDisponivel - lote.qtdeReservada
      if (data.qtde > livre) {
        throw new LoteBaixaError(
          livre > 0
            ? `Só tem ${livre} unidade${livre === 1 ? '' : 's'} livre${livre === 1 ? '' : 's'} pra baixa nesse lote — o resto já está reservado.`
            : 'Esse lote não tem unidades livres pra baixa — o que sobrou já está reservado.',
        )
      }

      await tx.lote.update({ where: { id: data.loteId }, data: { qtdeDisponivel: { decrement: data.qtde } } })
      await tx.loteBaixa.create({
        data: { loteId: data.loteId, qtde: data.qtde, motivo: data.motivo, observacao: data.observacao },
      })
    })
  } catch (err) {
    if (err instanceof LoteBaixaError) return { error: err.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'lote_baixa_manual',
    entityType: 'lote',
    entityId: data.loteId,
    metadata: { qtde: data.qtde, motivo: data.motivo, observacao: data.observacao },
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/lotes')
  return { ok: true }
}

export type DadosProducao = {
  receita: {
    id: string
    nome: string
    rendimentoPadrao: number
    validadeDias: number | null
    custoGas: string | null
  }
  linhasBase: Array<{
    ingredienteId: string
    nome: string
    unidadeBase: string
    qtdeBase: string
    compraSelecionada: { id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string } | null
  }>
  variacoes: Array<{
    id: string
    nome: string
    recheio: {
      id: string
      nome: string
      gramasUsadas: string
      pesoTotalG: string
      custoGas: string | null
      linhas: Array<{
        ingredienteId: string
        nome: string
        unidadeBase: string
        qtdeBase: string
        compraSelecionada: { id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string } | null
      }>
    } | null
  }>
}

/**
 * D-13 — dados pra montar o form de produção, produto-cêntrico: a base
 * aparece uma vez, e cada Variação ATIVA do produto vem com seu próprio
 * bloco de recheio (quando tiver). Expõe `custoGas` do recheio também
 * (antes só o server somava certo na produção real — o preview do client
 * subestimava o custo quando o recheio tinha gás próprio).
 */
export async function dadosProducao(produtoId: string): Promise<DadosProducao | null> {
  try {
    await requireAdmin()
  } catch {
    return null
  }
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      include: { variacoes: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
    })
    if (!produto?.receitaId) return null

    const receita = await prisma.receita.findUnique({
      where: { id: produto.receitaId },
      include: { itens: { include: { ingrediente: true } } },
    })
    if (!receita) return null

    const recheioReceitaIds = [
      ...new Set(produto.variacoes.flatMap((v) => (v.recheioReceitaId ? [v.recheioReceitaId] : []))),
    ]
    const recheioReceitas = recheioReceitaIds.length
      ? await prisma.receita.findMany({
          where: { id: { in: recheioReceitaIds } },
          include: { itens: { include: { ingrediente: true } } },
        })
      : []
    const recheioReceitaPorId = new Map(recheioReceitas.map((r) => [r.id, r]))

    const todosIngredienteIds = [
      ...receita.itens.map((item) => item.ingredienteId),
      ...recheioReceitas.flatMap((r) => r.itens.map((item) => item.ingredienteId)),
    ]
    const ultimas = await ultimasCompras(todosIngredienteIds)

    function serializarLinha(item: {
      ingredienteId: string
      qtde: Decimal
      ingrediente: { nome: string; unidadeBase: string }
    }) {
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
    }

    return {
      receita: {
        id: receita.id,
        nome: receita.nome,
        rendimentoPadrao: receita.rendimentoPadrao,
        validadeDias: receita.validadeDias,
        custoGas: receita.custoGas ? receita.custoGas.toFixed(4) : null,
      },
      linhasBase: receita.itens.map(serializarLinha),
      variacoes: produto.variacoes.map((v) => {
        const recheioReceita = v.recheioReceitaId ? recheioReceitaPorId.get(v.recheioReceitaId) : undefined
        return {
          id: v.id,
          nome: v.nome,
          recheio: recheioReceita
            ? {
                id: recheioReceita.id,
                nome: recheioReceita.nome,
                gramasUsadas: v.recheioGramasUsadas ? v.recheioGramasUsadas.toFixed(3) : '0',
                pesoTotalG: pesoTotalGramasReceita(recheioReceita.itens).pesoTotalG.toFixed(3),
                custoGas: recheioReceita.custoGas ? recheioReceita.custoGas.toFixed(4) : null,
                linhas: recheioReceita.itens.map(serializarLinha),
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
