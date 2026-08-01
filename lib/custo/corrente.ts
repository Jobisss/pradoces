import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'

/**
 * TODA aritmética de custo do projeto mora aqui. Nada fora de lib/custo
 * soma/multiplica dinheiro.
 */

export type UltimaCompra = {
  id: string
  ingredienteId: string
  marca: string
  custoPorUnidadeBase: Decimal
  dataCompra: Date
}

type UltimaCompraRow = {
  id: string
  ingrediente_id: string
  marca: string
  custo_por_unidade_base: Decimal
  data_compra: Date
}

/**
 * Última compra de cada ingrediente (ING-05) — 1 round-trip via DISTINCT ON,
 * desempate data_compra DESC, criado_em DESC (assunção A2).
 */
export async function ultimasCompras(ingredienteIds: string[]): Promise<Map<string, UltimaCompra>> {
  if (ingredienteIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<UltimaCompraRow[]>`
    SELECT DISTINCT ON (ingrediente_id)
           id, ingrediente_id, marca, custo_por_unidade_base, data_compra
    FROM ingrediente_compras
    WHERE ingrediente_id = ANY(${ingredienteIds}::uuid[])
    ORDER BY ingrediente_id, data_compra DESC, criado_em DESC
  `

  const map = new Map<string, UltimaCompra>()
  for (const row of rows) {
    map.set(row.ingrediente_id, {
      id: row.id,
      ingredienteId: row.ingrediente_id,
      marca: row.marca,
      custoPorUnidadeBase: new Decimal(row.custo_por_unidade_base),
      dataCompra: row.data_compra,
    })
  }
  return map
}

type ReceitaComItens = {
  rendimentoPadrao: number
  custoGas: Decimal | null
  itens: { ingredienteId: string; qtde: Decimal; ingrediente?: { nome: string } }[]
}

/** Soma qtde × custo da última compra de cada item + gás. Itens sem compra contribuem 0. */
function somaCustoItens(itens: ReceitaComItens['itens'], ultimas: Map<string, UltimaCompra>) {
  let total = new Decimal(0)
  let algumEncontrado = false
  const faltamCompras: string[] = []
  for (const item of itens) {
    const ultima = ultimas.get(item.ingredienteId)
    if (!ultima) {
      if (item.ingrediente) faltamCompras.push(item.ingrediente.nome)
      continue
    }
    algumEncontrado = true
    total = total.plus(new Decimal(item.qtde).times(ultima.custoPorUnidadeBase))
  }
  return { total, algumEncontrado, faltamCompras }
}

/**
 * Custo corrente de uma receita (REC-05) = Σ(qtde × custo da última compra de
 * cada ingrediente) + gás, com rendimento PADRÃO (D-09 — o rendimento REAL só
 * entra no custo congelado, ver lib/custo/congelado.ts).
 */
export async function custoCorrenteReceita(
  receitaId: string,
): Promise<{ total: Decimal; porUnidade: Decimal; faltamCompras: string[] }> {
  const receita = await prisma.receita.findUniqueOrThrow({
    where: { id: receitaId },
    include: { itens: { include: { ingrediente: true } } },
  })

  const ultimas = await ultimasCompras(receita.itens.map((item) => item.ingredienteId))
  const { total: somaItens, faltamCompras } = somaCustoItens(receita.itens, ultimas)
  const total = receita.custoGas ? somaItens.plus(new Decimal(receita.custoGas)) : somaItens
  const porUnidade = total.dividedBy(receita.rendimentoPadrao)

  return { total, porUnidade, faltamCompras }
}

/**
 * Custo corrente de VÁRIAS receitas de uma vez, sem N+1 (Pitfall 9 — usada
 * pela lista de receitas): 1 chamada ultimasCompras com todos os
 * ingredienteIds coletados, resto em memória. `receitas` já vem com `itens`
 * (e opcionalmente `itens.ingrediente` pro nome aparecer em faltamCompras).
 */
export async function custosCorrentesReceitas(
  receitas: Array<{ id: string } & ReceitaComItens>,
): Promise<Map<string, { total: Decimal; porUnidade: Decimal; faltamCompras: string[] }>> {
  const ingredienteIds = new Set<string>()
  for (const receita of receitas) {
    for (const item of receita.itens) ingredienteIds.add(item.ingredienteId)
  }
  const ultimas = await ultimasCompras([...ingredienteIds])

  const resultado = new Map<string, { total: Decimal; porUnidade: Decimal; faltamCompras: string[] }>()
  for (const receita of receitas) {
    const { total: somaItens, faltamCompras } = somaCustoItens(receita.itens, ultimas)
    const total = receita.custoGas ? somaItens.plus(new Decimal(receita.custoGas)) : somaItens
    resultado.set(receita.id, {
      total,
      porUnidade: total.dividedBy(receita.rendimentoPadrao),
      faltamCompras,
    })
  }
  return resultado
}

/**
 * Custo corrente de um produto. UNITARIO delega pra custoCorrenteReceita da
 * receita vinculada. KIT soma os custos por unidade dos componentes × qtde
 * (D-11) — cada componente é, por definição, um produto UNITARIO com receita.
 */
export async function custoCorrenteProduto(
  produtoId: string,
): Promise<{ custo: Decimal; faltamCompras: string[] }> {
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: produtoId },
    include: { kitItens: { include: { componente: true } } },
  })

  if (produto.tipo === 'UNITARIO') {
    if (!produto.receitaId) return { custo: new Decimal(0), faltamCompras: [] }
    const { porUnidade, faltamCompras } = await custoCorrenteReceita(produto.receitaId)
    return { custo: porUnidade, faltamCompras }
  }

  let custo = new Decimal(0)
  const faltamCompras: string[] = []
  for (const kitItem of produto.kitItens) {
    if (!kitItem.componente.receitaId) continue
    const { porUnidade, faltamCompras: faltamComponente } = await custoCorrenteReceita(
      kitItem.componente.receitaId,
    )
    custo = custo.plus(porUnidade.times(kitItem.qtde))
    faltamCompras.push(...faltamComponente)
  }
  return { custo, faltamCompras }
}

/**
 * Margem A1: (preço − custo) ÷ preço × 100 — "de cada R$10, R$3 ficam com
 * você". Preço ≤ 0 retorna 0 (evita divisão por zero / margem sem sentido).
 */
export function margemPercent(preco: Decimal, custo: Decimal): Decimal {
  if (preco.lessThanOrEqualTo(0)) return new Decimal(0)
  return preco.minus(custo).dividedBy(preco).times(100)
}

/**
 * Margens correntes de TODOS os produtos, sem N+1 (Pitfall 9 — usada pela
 * lista de produtos e pela home admin "Precisa de atenção"): 1 query de
 * produtos com receitas/kits aninhados, 1 chamada ultimasCompras com todos os
 * ingredienteIds coletados, 1 findUnique de Configuracao. `custo`/`margem`
 * ficam `null` só quando NENHUM item do produto (ou dos componentes do kit)
 * tem compra registrada ainda — parcial com pelo menos 1 compra soma normal
 * (mesmo comportamento de custoCorrenteReceita, que ignora itens sem compra).
 */
export async function margensCorrentesBatch(): Promise<
  Array<{
    produtoId: string
    nome: string
    tipo: 'UNITARIO' | 'KIT'
    precoVenda: Decimal
    custo: Decimal | null
    margem: Decimal | null
    minima: Decimal
  }>
> {
  const produtos = await prisma.produto.findMany({
    include: {
      receita: { include: { itens: true } },
      kitItens: {
        include: { componente: { include: { receita: { include: { itens: true } } } } },
      },
    },
  })

  const ingredienteIds = new Set<string>()
  for (const produto of produtos) {
    for (const item of produto.receita?.itens ?? []) ingredienteIds.add(item.ingredienteId)
    for (const kitItem of produto.kitItens) {
      for (const item of kitItem.componente.receita?.itens ?? []) ingredienteIds.add(item.ingredienteId)
    }
  }
  const ultimas = await ultimasCompras([...ingredienteIds])

  const config = await prisma.configuracao.findUnique({ where: { id: 1 } })
  const margemMinimaGlobal = config ? new Decimal(config.margemMinimaPadrao) : new Decimal(30)

  function custoReceitaEmMemoria(receita: ReceitaComItens | null | undefined) {
    if (!receita) return { porUnidade: new Decimal(0), algumEncontrado: false }
    const { total: somaItens, algumEncontrado } = somaCustoItens(receita.itens, ultimas)
    const total = receita.custoGas ? somaItens.plus(new Decimal(receita.custoGas)) : somaItens
    return { porUnidade: total.dividedBy(receita.rendimentoPadrao), algumEncontrado }
  }

  return produtos.map((produto) => {
    const minima = produto.margemMinimaOverride
      ? new Decimal(produto.margemMinimaOverride)
      : margemMinimaGlobal
    const precoVenda = new Decimal(produto.precoVenda)

    let custoBruto = new Decimal(0)
    let algumEncontrado = false
    if (produto.tipo === 'UNITARIO') {
      const r = custoReceitaEmMemoria(produto.receita)
      custoBruto = r.porUnidade
      algumEncontrado = r.algumEncontrado
    } else {
      for (const kitItem of produto.kitItens) {
        const r = custoReceitaEmMemoria(kitItem.componente.receita)
        if (r.algumEncontrado) algumEncontrado = true
        custoBruto = custoBruto.plus(r.porUnidade.times(kitItem.qtde))
      }
    }

    const custo = algumEncontrado ? custoBruto : null
    const margem = custo === null ? null : margemPercent(precoVenda, custo)

    return { produtoId: produto.id, nome: produto.nome, tipo: produto.tipo, precoVenda, custo, margem, minima }
  })
}
