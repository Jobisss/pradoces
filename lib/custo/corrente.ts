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
  itens: { ingredienteId: string; qtde: Decimal; ingrediente?: { nome: string; unidadeBase?: string } }[]
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
 * Peso total (g) de uma receita de recheio — soma da qtde dos itens cuja
 * unidade base do ingrediente é 'g'. Itens em 'ml'/'un' ficam de fora (não dá
 * pra somar peso com volume/unidade sem densidade) e voltam em
 * `itensForaDeGramas` pra avisar a mãe. Usado pra ratear o custo do recheio
 * por regra de 3 (grama usada no produto ÷ peso total da receita) — ver
 * custoCorrenteRecheio.
 */
export function pesoTotalGramasReceita(itens: ReceitaComItens['itens']): {
  pesoTotalG: Decimal
  itensForaDeGramas: string[]
} {
  let pesoTotalG = new Decimal(0)
  const itensForaDeGramas: string[] = []
  for (const item of itens) {
    if (item.ingrediente?.unidadeBase === 'g') {
      pesoTotalG = pesoTotalG.plus(new Decimal(item.qtde))
    } else if (item.ingrediente) {
      itensForaDeGramas.push(item.ingrediente.nome)
    }
  }
  return { pesoTotalG, itensForaDeGramas }
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
 * Custo de um recheio RATEADO por regra de 3: (custo total da receita ÷ peso
 * total em gramas dela) × gramas usadas neste produto. Diferente de
 * custoCorrenteReceita — o recheio é uma receita "de lote" (ex.: brigadeiro
 * inteiro), não uma receita "por unidade final"; o rendimentoPadrao dela não
 * entra nessa conta, só o peso.
 */
export async function custoCorrenteRecheio(
  recheioReceitaId: string,
  gramasUsadas: Decimal,
): Promise<{
  custoParaProduto: Decimal
  pesoTotalG: Decimal
  faltamCompras: string[]
  itensForaDeGramas: string[]
}> {
  const receita = await prisma.receita.findUniqueOrThrow({
    where: { id: recheioReceitaId },
    include: { itens: { include: { ingrediente: true } } },
  })

  const ultimas = await ultimasCompras(receita.itens.map((item) => item.ingredienteId))
  const { total: somaItens, faltamCompras } = somaCustoItens(receita.itens, ultimas)
  const totalReceita = receita.custoGas ? somaItens.plus(new Decimal(receita.custoGas)) : somaItens
  const { pesoTotalG, itensForaDeGramas } = pesoTotalGramasReceita(receita.itens)

  const custoParaProduto = pesoTotalG.isZero()
    ? new Decimal(0)
    : totalReceita.dividedBy(pesoTotalG).times(gramasUsadas)

  return { custoParaProduto, pesoTotalG, faltamCompras, itensForaDeGramas }
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
 * Custo corrente de uma Variação (D-13) = custo da receita BASE do produto
 * dela (custoCorrenteReceita) + custo do recheio dela quando houver, rateado
 * por grama (custoCorrenteRecheio). Substitui o antigo branch UNITARIO de
 * custoCorrenteProduto — a diferença é que recheio/gramas agora vêm da
 * Variação, não do Produto.
 */
export async function custoCorrenteVariacao(
  variacaoId: string,
): Promise<{ custo: Decimal; faltamCompras: string[] }> {
  const variacao = await prisma.variacao.findUniqueOrThrow({
    where: { id: variacaoId },
    include: { produto: { select: { receitaId: true } } },
  })

  if (!variacao.produto.receitaId) return { custo: new Decimal(0), faltamCompras: [] }
  const base = await custoCorrenteReceita(variacao.produto.receitaId)
  if (!variacao.recheioReceitaId) return { custo: base.porUnidade, faltamCompras: base.faltamCompras }
  const gramasUsadas = variacao.recheioGramasUsadas ? new Decimal(variacao.recheioGramasUsadas) : new Decimal(0)
  const recheio = await custoCorrenteRecheio(variacao.recheioReceitaId, gramasUsadas)
  return {
    custo: base.porUnidade.plus(recheio.custoParaProduto),
    faltamCompras: [...base.faltamCompras, ...recheio.faltamCompras],
  }
}

/**
 * Custo corrente de um KIT (D-11/D-13) = soma dos custos por unidade dos
 * componentes × qtde. Cada item de kit aponta pra uma Variação ESPECÍFICA do
 * componente (não "qualquer sabor") — por isso usa custoCorrenteVariacao, o
 * que também corrige um gap antigo: antes o custo de kit ignorava totalmente
 * o recheio dos componentes (só olhava a receita base deles).
 */
export async function custoCorrenteKit(
  produtoId: string,
): Promise<{ custo: Decimal; faltamCompras: string[] }> {
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: produtoId },
    include: { kitItens: true },
  })

  let custo = new Decimal(0)
  const faltamCompras: string[] = []
  for (const kitItem of produto.kitItens) {
    if (!kitItem.componenteVariacaoId) continue
    const { custo: custoVariacao, faltamCompras: faltamVariacao } = await custoCorrenteVariacao(
      kitItem.componenteVariacaoId,
    )
    custo = custo.plus(custoVariacao.times(kitItem.qtde))
    faltamCompras.push(...faltamVariacao)
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
 * Margens correntes de TODAS as Variações (UNITARIO) + de todos os KITs, sem
 * N+1 (Pitfall 9 — usada pela lista de produtos, pela home admin "Precisa de
 * atenção" e pela tela de cadastro de resgate): 1 query de produtos com
 * variações/kits aninhados, 1 chamada ultimasCompras com todos os
 * ingredienteIds coletados, 1 findUnique de Configuracao. Uma linha por
 * Variação ativa (`variacaoId` preenchido) pra UNITARIO, uma linha por KIT
 * (`variacaoId: null`). `custo`/`margem` ficam `null` só quando NENHUM item
 * (base ou recheio/componentes) tem compra registrada ainda.
 */
export async function margensCorrentesBatch(): Promise<
  Array<{
    produtoId: string
    variacaoId: string | null
    nome: string
    produtoNome: string
    variacaoNome: string | null
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
      variacoes: {
        // precisa de ingrediente.unidadeBase pra pesoTotalGramasReceita (rateio do recheio)
        include: { receitaRecheio: { include: { itens: { include: { ingrediente: true } } } } },
      },
      kitItens: {
        include: {
          componenteVariacao: {
            include: {
              produto: { include: { receita: { include: { itens: true } } } },
              receitaRecheio: { include: { itens: { include: { ingrediente: true } } } },
            },
          },
        },
      },
    },
  })

  const ingredienteIds = new Set<string>()
  for (const produto of produtos) {
    for (const item of produto.receita?.itens ?? []) ingredienteIds.add(item.ingredienteId)
    for (const variacao of produto.variacoes) {
      for (const item of variacao.receitaRecheio?.itens ?? []) ingredienteIds.add(item.ingredienteId)
    }
    for (const kitItem of produto.kitItens) {
      const cv = kitItem.componenteVariacao
      if (!cv) continue
      for (const item of cv.produto.receita?.itens ?? []) ingredienteIds.add(item.ingredienteId)
      for (const item of cv.receitaRecheio?.itens ?? []) ingredienteIds.add(item.ingredienteId)
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

  /** Equivalente em memória de custoCorrenteRecheio — mesma regra de 3 por peso. */
  function custoRecheioEmMemoria(receita: ReceitaComItens | null | undefined, gramasUsadas: Decimal | null) {
    if (!receita || !gramasUsadas) return { custoParaProduto: new Decimal(0), algumEncontrado: false }
    const { total: somaItens, algumEncontrado } = somaCustoItens(receita.itens, ultimas)
    const total = receita.custoGas ? somaItens.plus(new Decimal(receita.custoGas)) : somaItens
    const { pesoTotalG } = pesoTotalGramasReceita(receita.itens)
    const custoParaProduto = pesoTotalG.isZero() ? new Decimal(0) : total.dividedBy(pesoTotalG).times(gramasUsadas)
    return { custoParaProduto, algumEncontrado }
  }

  /** Equivalente em memória de custoCorrenteVariacao — base + recheio (quando houver). */
  function custoVariacaoEmMemoria(
    receitaBase: ReceitaComItens | null | undefined,
    receitaRecheio: ReceitaComItens | null | undefined,
    gramasUsadas: Decimal | null,
  ) {
    const base = custoReceitaEmMemoria(receitaBase)
    let custo = base.porUnidade
    let algumEncontrado = base.algumEncontrado
    if (receitaRecheio) {
      const recheio = custoRecheioEmMemoria(receitaRecheio, gramasUsadas)
      custo = custo.plus(recheio.custoParaProduto)
      if (recheio.algumEncontrado) algumEncontrado = true
    }
    return { custo, algumEncontrado }
  }

  type Linha = {
    produtoId: string
    variacaoId: string | null
    nome: string
    produtoNome: string
    variacaoNome: string | null
    tipo: 'UNITARIO' | 'KIT'
    precoVenda: Decimal
    custo: Decimal | null
    margem: Decimal | null
    minima: Decimal
  }
  const linhas: Linha[] = []

  for (const produto of produtos) {
    if (produto.tipo === 'UNITARIO') {
      for (const variacao of produto.variacoes) {
        const minima = variacao.margemMinimaOverride ? new Decimal(variacao.margemMinimaOverride) : margemMinimaGlobal
        const precoVenda = new Decimal(variacao.precoVenda)
        const gramasUsadas = variacao.recheioGramasUsadas ? new Decimal(variacao.recheioGramasUsadas) : null
        const { custo: custoBruto, algumEncontrado } = custoVariacaoEmMemoria(
          produto.receita,
          variacao.receitaRecheio,
          gramasUsadas,
        )
        const custo = algumEncontrado ? custoBruto : null
        const margem = custo === null ? null : margemPercent(precoVenda, custo)
        linhas.push({
          produtoId: produto.id,
          variacaoId: variacao.id,
          nome: `${produto.nome} — ${variacao.nome}`,
          produtoNome: produto.nome,
          variacaoNome: variacao.nome,
          tipo: 'UNITARIO',
          precoVenda,
          custo,
          margem,
          minima,
        })
      }
    } else {
      const minima = produto.margemMinimaOverride ? new Decimal(produto.margemMinimaOverride) : margemMinimaGlobal
      const precoVenda = new Decimal(produto.precoVenda ?? 0)
      let custoBruto = new Decimal(0)
      let algumEncontrado = false
      for (const kitItem of produto.kitItens) {
        const cv = kitItem.componenteVariacao
        if (!cv) continue
        const gramasUsadas = cv.recheioGramasUsadas ? new Decimal(cv.recheioGramasUsadas) : null
        const r = custoVariacaoEmMemoria(cv.produto.receita, cv.receitaRecheio, gramasUsadas)
        if (r.algumEncontrado) algumEncontrado = true
        custoBruto = custoBruto.plus(r.custo.times(kitItem.qtde))
      }
      const custo = algumEncontrado ? custoBruto : null
      const margem = custo === null ? null : margemPercent(precoVenda, custo)
      linhas.push({
        produtoId: produto.id,
        variacaoId: null,
        nome: produto.nome,
        produtoNome: produto.nome,
        variacaoNome: null,
        tipo: 'KIT',
        precoVenda,
        custo,
        margem,
        minima,
      })
    }
  }

  return linhas
}
