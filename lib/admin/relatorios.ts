import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'

/** "YYYY-MM" em America/Sao_Paulo — en-CA já formata nessa ordem. */
function mesSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(
    data,
  )
}

export type ProdutoRelatorio = {
  produtoId: string
  variacaoId: string | null
  nome: string
  qtde: number
  receita: Decimal
  custo: Decimal
  lucro: Decimal
  margemPercent: Decimal
}

/** Custo que saiu do estoque sem virar receita em R$. */
export type CustoSemVenda = { custo: Decimal; unidades: number }

export type RelatorioFaturamento = {
  faturamentoTotal: Decimal
  /** Custo congelado do que foi VENDIDO (o antigo `custoTotal`). */
  custoVendas: Decimal
  /** Doce entregue em troca de pontos: saiu do estoque, não gerou receita. */
  resgates: CustoSemVenda
  /** Quanto ela deixou de faturar nesses resgates (preço de venda congelado). */
  valorDeixadoDeGanhar: Decimal
  /** Lote vencido/estragado (LoteBaixa) — prejuízo puro. */
  perdas: CustoSemVenda
  /** Vendas + resgates + perdas. Tudo que o estoque consumiu no período. */
  custoTotal: Decimal
  /** faturamento − custoTotal. */
  lucroTotal: Decimal
  topPorReceita: ProdutoRelatorio[]
  topPorMargem: ProdutoRelatorio[]
}

const STATUS_VALIDO = ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] as const

/**
 * FIN-01/02/03/04 — um único findMany (sem N+1: select explícito, join até
 * Lote pro custo CONGELADO daquela venda específica, nunca o custo corrente
 * — "lucro real" é preço−custo de quando o lote foi produzido, não de hoje).
 * Só reserva tipo PADRAO conta como FATURAMENTO — resgate é pago em pontos,
 * não é receita em R$. Mas o CUSTO do resgate conta: o doce foi produzido e
 * consumiu ingrediente. Antes o filtro `tipo: 'PADRAO'` derrubava os dois
 * lados, e o custo do que saiu por pontos não aparecia em lugar nenhum — o
 * lucro vinha inflado em custo/un × unidades resgatadas. Mesma coisa com
 * lote vencido/estragado (LoteBaixa), que também nunca entrava aqui.
 *
 * D-13: agrupa por VARIAÇÃO (`lote.variacaoId`), não por produto — é isso
 * que permite ver o lucro separado por sabor. KIT nunca aparece aqui direto:
 * um ReservaItem de kit já é o lote do COMPONENTE (uma variação de um
 * produto UNITARIO), resolvido na hora da reserva.
 *
 * `topPorReceita`/`topPorMargem` seguem só com PADRAO: são rankings de
 * VENDA, e uma linha de receita zero afundaria a margem do sabor.
 */
export async function relatorioFaturamento(desde: Date, ate: Date): Promise<RelatorioFaturamento> {
  const [reservas, resgates, baixas] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        tipo: 'PADRAO',
        status: { in: [...STATUS_VALIDO] },
        confirmadaEm: { gte: desde, lt: ate },
      },
      select: {
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: {
              select: {
                custoPorUnidadeCongelado: true,
                produtoId: true,
                variacaoId: true,
                produto: { select: { nome: true } },
                variacao: { select: { nome: true } },
              },
            },
          },
        },
      },
    }),
    prisma.reserva.findMany({
      where: {
        tipo: 'RESGATE',
        status: { in: [...STATUS_VALIDO] },
        confirmadaEm: { gte: desde, lt: ate },
      },
      select: {
        valorResgateCongelado: true,
        itens: { select: { qtde: true, lote: { select: { custoPorUnidadeCongelado: true } } } },
      },
    }),
    prisma.loteBaixa.findMany({
      where: { criadoEm: { gte: desde, lt: ate } },
      select: { qtde: true, lote: { select: { custoPorUnidadeCongelado: true } } },
    }),
  ])

  const porVariacao = new Map<
    string,
    { produtoId: string; variacaoId: string | null; nome: string; receita: Decimal; custo: Decimal; qtde: number }
  >()
  for (const r of reservas) {
    for (const item of r.itens) {
      const receita = item.precoUnitarioCongelado.times(item.qtde)
      const custo = item.lote.custoPorUnidadeCongelado.times(item.qtde)
      const chave = item.lote.variacaoId ?? item.lote.produtoId
      const nome = item.lote.variacao
        ? `${item.lote.produto.nome} — ${item.lote.variacao.nome}`
        : item.lote.produto.nome
      const atual = porVariacao.get(chave) ?? {
        produtoId: item.lote.produtoId,
        variacaoId: item.lote.variacaoId,
        nome,
        receita: new Decimal(0),
        custo: new Decimal(0),
        qtde: 0,
      }
      atual.receita = atual.receita.plus(receita)
      atual.custo = atual.custo.plus(custo)
      atual.qtde += item.qtde
      porVariacao.set(chave, atual)
    }
  }

  const lista: ProdutoRelatorio[] = [...porVariacao.values()].map((v) => ({
    produtoId: v.produtoId,
    variacaoId: v.variacaoId,
    nome: v.nome,
    qtde: v.qtde,
    receita: v.receita,
    custo: v.custo,
    lucro: v.receita.minus(v.custo),
    margemPercent: v.receita.isZero() ? new Decimal(0) : v.receita.minus(v.custo).dividedBy(v.receita).times(100),
  }))

  const faturamentoTotal = lista.reduce((s, p) => s.plus(p.receita), new Decimal(0))
  const custoVendas = lista.reduce((s, p) => s.plus(p.custo), new Decimal(0))

  const custoResgates = resgates.reduce(
    (soma, r) =>
      r.itens.reduce((s, i) => s.plus(i.lote.custoPorUnidadeCongelado.times(i.qtde)), soma),
    new Decimal(0)
  )
  const unidadesResgatadas = resgates.reduce(
    (soma, r) => soma + r.itens.reduce((s, i) => s + i.qtde, 0),
    0
  )
  const valorDeixadoDeGanhar = resgates.reduce(
    (soma, r) => (r.valorResgateCongelado ? soma.plus(r.valorResgateCongelado.toString()) : soma),
    new Decimal(0)
  )

  const custoPerdas = baixas.reduce(
    (soma, b) => soma.plus(b.lote.custoPorUnidadeCongelado.times(b.qtde)),
    new Decimal(0)
  )
  const unidadesPerdidas = baixas.reduce((soma, b) => soma + b.qtde, 0)

  const custoTotal = custoVendas.plus(custoResgates).plus(custoPerdas)

  return {
    faturamentoTotal,
    custoVendas,
    resgates: { custo: custoResgates, unidades: unidadesResgatadas },
    valorDeixadoDeGanhar,
    perdas: { custo: custoPerdas, unidades: unidadesPerdidas },
    custoTotal,
    lucroTotal: faturamentoTotal.minus(custoTotal),
    topPorReceita: [...lista].sort((a, b) => b.receita.comparedTo(a.receita)).slice(0, 10),
    topPorMargem: [...lista].sort((a, b) => b.margemPercent.comparedTo(a.margemPercent)).slice(0, 10),
  }
}

export type MesAgregado = { mes: string; receita: Decimal; custo: Decimal; lucro: Decimal }

/**
 * FIN-04/06 — histórico mensal (lucro real por produto quando `produtoId` é
 * passado — FIN-04; por sabor específico quando `variacaoId` é passado —
 * D-13; sazonalidade agregando tudo quando nenhum dos dois — FIN-06). "Mês"
 * é o mês de CONFIRMAÇÃO em America/Sao_Paulo. `variacaoId` tem prioridade
 * sobre `produtoId` quando os dois vêm preenchidos.
 */
export async function historicoMensal(meses = 12, produtoId?: string, variacaoId?: string): Promise<MesAgregado[]> {
  const desde = new Date()
  desde.setUTCMonth(desde.getUTCMonth() - meses)

  // Receita só de PADRAO; custo dos três caminhos que consomem estoque
  // (venda, resgate e baixa) — mesma regra de relatorioFaturamento.
  const [reservas, baixas] = await Promise.all([
    prisma.reserva.findMany({
      where: { status: { in: [...STATUS_VALIDO] }, confirmadaEm: { gte: desde } },
      select: {
        tipo: true,
        confirmadaEm: true,
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: { select: { custoPorUnidadeCongelado: true, produtoId: true, variacaoId: true } },
          },
        },
      },
    }),
    prisma.loteBaixa.findMany({
      where: { criadoEm: { gte: desde } },
      select: {
        qtde: true,
        criadoEm: true,
        lote: { select: { custoPorUnidadeCongelado: true, produtoId: true, variacaoId: true } },
      },
    }),
  ])

  /** O filtro de produto/sabor da tela vale pros três caminhos. */
  function fora(lote: { produtoId: string; variacaoId: string | null }): boolean {
    if (variacaoId) return lote.variacaoId !== variacaoId
    if (produtoId) return lote.produtoId !== produtoId
    return false
  }

  const porMes = new Map<string, { receita: Decimal; custo: Decimal }>()
  function acumular(mes: string, receita: Decimal, custo: Decimal) {
    const atual = porMes.get(mes) ?? { receita: new Decimal(0), custo: new Decimal(0) }
    atual.receita = atual.receita.plus(receita)
    atual.custo = atual.custo.plus(custo)
    porMes.set(mes, atual)
  }

  for (const r of reservas) {
    const mes = mesSaoPaulo(r.confirmadaEm!)
    for (const item of r.itens) {
      if (fora(item.lote)) continue
      // Resgate entra só com custo — o preço congelado dele é 0 de propósito.
      const receita =
        r.tipo === 'RESGATE' ? new Decimal(0) : item.precoUnitarioCongelado.times(item.qtde)
      acumular(mes, receita, item.lote.custoPorUnidadeCongelado.times(item.qtde))
    }
  }

  for (const b of baixas) {
    if (fora(b.lote)) continue
    acumular(mesSaoPaulo(b.criadoEm), new Decimal(0), b.lote.custoPorUnidadeCongelado.times(b.qtde))
  }

  return [...porMes.entries()]
    .map(([mes, v]) => ({ mes, receita: v.receita, custo: v.custo, lucro: v.receita.minus(v.custo) }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

export type MargemPorMarca = {
  ingrediente: string
  marca: string
  lotesUsados: number
  unidadesVendidas: number
  lucroTotal: string
}

/**
 * FIN-05 — "qual marca de leite condensado rendeu mais brigadeiro
 * lucrativo": agrega TODOS os lotes que usaram cada (ingrediente, marca),
 * soma o lucro real (preço−custo congelado) de tudo que já foi vendido
 * daqueles lotes. Se um lote usa 2 ingredientes (leite condensado marca X +
 * chocolate marca Y), o lucro dele conta pras DUAS linhas — é
 * "como performaram os lotes que usaram essa marca", não uma tentativa de
 * atribuir fatia exata de margem por ingrediente (não dá pra separar isso
 * com precisão sem uma regra de rateio arbitrária).
 *
 * $queryRaw (não Prisma client) — agregação em 3 joins + CTE, mesma
 * convenção já usada pra evitar N+1 em relatórios pesados (ROADMAP Phase 7
 * pitfalls).
 */
export async function margemPorMarca(): Promise<MargemPorMarca[]> {
  return prisma.$queryRaw<MargemPorMarca[]>`
    WITH vendas_validas AS (
      SELECT ri.lote_id, ri.qtde, ri.preco_unitario_congelado
      FROM reserva_itens ri
      JOIN reservas r ON r.id = ri.reserva_id
      WHERE r.tipo = 'PADRAO' AND r.status IN ('CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA')
    )
    SELECT
      ing.nome AS ingrediente,
      lui.marca_snapshot AS marca,
      COUNT(DISTINCT lui.lote_id)::int AS "lotesUsados",
      COALESCE(SUM(vv.qtde), 0)::int AS "unidadesVendidas",
      COALESCE(SUM(vv.qtde * (vv.preco_unitario_congelado - l.custo_por_unidade_congelado)), 0)::text AS "lucroTotal"
    FROM lote_uso_ingredientes lui
    JOIN ingrediente_compras ic ON ic.id = lui.ingrediente_compra_id
    JOIN ingredientes ing ON ing.id = ic.ingrediente_id
    JOIN lotes l ON l.id = lui.lote_id
    LEFT JOIN vendas_validas vv ON vv.lote_id = l.id
    GROUP BY ing.nome, lui.marca_snapshot
    ORDER BY COALESCE(SUM(vv.qtde * (vv.preco_unitario_congelado - l.custo_por_unidade_congelado)), 0) DESC`
}
