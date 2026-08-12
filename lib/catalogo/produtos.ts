import 'server-only'
import Decimal from 'decimal.js'
import { differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'
import { precoEfetivo, promocaoAtiva } from '@/lib/pricing/promocao'

/**
 * Queries do catálogo PÚBLICO (CAT-01..05). Diferença crítica pras queries
 * de admin: `select` explícito que NUNCA inclui custo/margem (custoTotalCongelado,
 * custoPorUnidadeCongelado, custoGasCongelado, tudo em Ingrediente/Compra) —
 * esse dado é só da mãe, vazar aqui seria expor markup pro cliente final.
 *
 * D-13: UNITARIO não tem mais 1 preço/estoque só — cada Variação (sabor) tem
 * o seu. "Disponível"/preço de vitrine passam a agregar por variação ATIVA;
 * kit (que aponta pra uma Variação específica de cada componente) também.
 */

export type ProdutoCard = {
  id: string
  nome: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  precoVenda: string
  precoOriginal: string | null
  precoAPartir: boolean
  capaPath: string | null
  disponivel: boolean
  emCampanha: boolean
  emPromocao: boolean
}

function inicioDoDiaSaoPaulo(): Date {
  return new Date(`${hojeSaoPaulo()}T00:00:00Z`)
}

/** produtoIds de UNITARIO com pelo menos 1 lote vigente, de uma variação ATIVA, com qtde disponível. */
async function idsComEstoque(): Promise<Set<string>> {
  const lotes = await prisma.lote.findMany({
    where: { validade: { gte: inicioDoDiaSaoPaulo() }, qtdeDisponivel: { gt: 0 }, variacao: { ativo: true } },
    select: { produtoId: true },
    distinct: ['produtoId'],
  })
  return new Set(lotes.map((l) => l.produtoId))
}

/**
 * Estoque LIVRE (qtde_disponivel - qtde_reservada, igual ao soft-hold de
 * criarReserva) somado por VARIAÇÃO, só lotes vigentes. Base pra calcular
 * quantos KITs inteiros dá pra montar com o que sobrou de cada componente
 * (cada item de kit aponta pra uma variação específica, D-13).
 */
async function estoqueLivrePorVariacao(variacaoIds: string[]): Promise<Map<string, number>> {
  if (variacaoIds.length === 0) return new Map()
  const lotes = await prisma.lote.findMany({
    where: { variacaoId: { in: variacaoIds }, validade: { gte: inicioDoDiaSaoPaulo() } },
    select: { variacaoId: true, qtdeDisponivel: true, qtdeReservada: true },
  })
  const livre = new Map<string, number>()
  for (const l of lotes) {
    if (!l.variacaoId) continue
    const atual = livre.get(l.variacaoId) ?? 0
    livre.set(l.variacaoId, atual + Math.max(0, l.qtdeDisponivel - l.qtdeReservada))
  }
  return livre
}

/** Quantos kits inteiros dá pra montar hoje — o gargalo é o componente (variação específica) com menos estoque livre relativo ao que o kit precisa. */
function kitsMontaveis(
  kitItens: Array<{ componenteVariacaoId: string | null; qtde: number }>,
  livrePorVariacao: Map<string, number>,
): number {
  if (kitItens.length === 0) return 0
  return Math.min(
    ...kitItens.map((k) => Math.floor((k.componenteVariacaoId ? (livrePorVariacao.get(k.componenteVariacaoId) ?? 0) : 0) / k.qtde)),
  )
}

export async function listarCategoriasAtivas(): Promise<string[]> {
  const rows = await prisma.produto.findMany({
    where: { ativo: true },
    select: { categoria: true },
    distinct: ['categoria'],
    orderBy: { categoria: 'asc' },
  })
  return rows.map((r) => r.categoria)
}

/**
 * CAT-01 — `campanhaId` filtra pra só os produtos vinculados à campanha
 * vigente (SAZON-04); sem campanhaId, mostra tudo normal (o card ainda
 * carrega `emCampanha` pra destacar visualmente quem tá na campanha).
 */
export async function listarProdutosAtivos(categoria?: string, campanhaId?: string): Promise<ProdutoCard[]> {
  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      ...(categoria ? { categoria } : {}),
      ...(campanhaId ? { campanhas: { some: { campanhaId } } } : {}),
    },
    select: {
      id: true,
      nome: true,
      categoria: true,
      tipo: true,
      precoVenda: true,
      fotos: { where: { ordem: 0 }, select: { path: true } },
      variacoes: {
        where: { ativo: true },
        select: { precoVenda: true, precoPromocional: true, promocaoInicio: true, promocaoFim: true },
      },
      kitItens: { select: { componenteVariacaoId: true, qtde: true } },
      campanhas: { select: { campanhaId: true } },
    },
    orderBy: { nome: 'asc' },
  })

  const disponiveis = await idsComEstoque()
  const componenteVariacaoIds = [
    ...new Set(
      produtos.flatMap((p) => p.kitItens.map((k) => k.componenteVariacaoId).filter((v): v is string => !!v)),
    ),
  ]
  const livrePorVariacao = await estoqueLivrePorVariacao(componenteVariacaoIds)
  const hoje = inicioDoDiaSaoPaulo()

  return produtos.map((p) => {
    let precoVenda = p.precoVenda
    let precoOriginal: Decimal | null = null
    let precoAPartir = false
    let emPromocao = false
    if (p.tipo === 'UNITARIO') {
      // Menor preço VIGENTE (já considerando promoção ativa) — a mesma
      // variação que "ganha" o "a partir de" define se mostra o selo/riscado,
      // pra não misturar o preço promocional de um sabor com o original de outro.
      let menor: { efetivo: Decimal; original: Decimal; ativa: boolean } | null = null
      for (const v of p.variacoes) {
        const efetivo = precoEfetivo(v, hoje)
        if (menor === null || efetivo.lessThan(menor.efetivo)) {
          menor = { efetivo, original: v.precoVenda, ativa: promocaoAtiva(v, hoje) }
        }
      }
      precoVenda = menor?.efetivo ?? null
      precoOriginal = menor?.ativa ? menor.original : null
      emPromocao = menor?.ativa ?? false
      precoAPartir = p.variacoes.length > 1
    }
    return {
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      tipo: p.tipo,
      precoVenda: precoVenda ? precoVenda.toFixed(2) : '0.00',
      precoOriginal: precoOriginal ? precoOriginal.toFixed(2) : null,
      precoAPartir,
      capaPath: p.fotos[0]?.path ?? null,
      disponivel: p.tipo === 'UNITARIO' ? disponiveis.has(p.id) : kitsMontaveis(p.kitItens, livrePorVariacao) > 0,
      emCampanha: p.campanhas.length > 0,
      emPromocao,
    }
  })
}

export type LoteDisponivel = { id: string; validade: string; qtdeDisponivel: number; diasParaVencer: number }
export type VariacaoDisponivel = {
  id: string
  nome: string
  precoVenda: string
  precoOriginal: string | null
  emPromocao: boolean
  lotes: LoteDisponivel[]
}

export type ProdutoDetalhe = {
  id: string
  nome: string
  descricao: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  precoVenda: string
  precoOriginal: string | null
  precoAPartir: boolean
  emPromocao: boolean
  alergenicos: string[]
  fotos: string[]
  variacoes: VariacaoDisponivel[]
  kitComponentes: Array<{ nome: string; variacaoNome: string | null; qtde: number }>
  kitDisponivel: number
}

/** CAT-05: `null` cobre tanto "não existe" quanto "desativado" — pro cliente é o mesmo 404. */
export async function buscarProdutoPublico(id: string): Promise<ProdutoDetalhe | null> {
  const produto = await prisma.produto.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      descricao: true,
      categoria: true,
      tipo: true,
      precoVenda: true,
      alergenicos: true,
      ativo: true,
      fotos: { orderBy: { ordem: 'asc' }, select: { path: true } },
      variacoes: {
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          precoVenda: true,
          precoPromocional: true,
          promocaoInicio: true,
          promocaoFim: true,
        },
        orderBy: { nome: 'asc' },
      },
      kitItens: {
        select: {
          qtde: true,
          componenteVariacaoId: true,
          componente: { select: { nome: true } },
          componenteVariacao: { select: { nome: true } },
        },
      },
    },
  })
  if (!produto || !produto.ativo) return null

  let variacoes: VariacaoDisponivel[] = []
  let kitDisponivel = 0
  if (produto.tipo === 'UNITARIO') {
    const hojeDate = inicioDoDiaSaoPaulo()
    const variacaoIds = produto.variacoes.map((v) => v.id)
    const rows = variacaoIds.length
      ? await prisma.lote.findMany({
          where: { variacaoId: { in: variacaoIds }, validade: { gte: hojeDate }, qtdeDisponivel: { gt: 0 } },
          select: { id: true, variacaoId: true, validade: true, qtdeDisponivel: true },
          orderBy: { validade: 'asc' },
        })
      : []
    const lotesPorVariacao = new Map<string, LoteDisponivel[]>()
    for (const l of rows) {
      if (!l.variacaoId) continue
      const arr = lotesPorVariacao.get(l.variacaoId) ?? []
      arr.push({
        id: l.id,
        validade: l.validade.toISOString(),
        qtdeDisponivel: l.qtdeDisponivel,
        diasParaVencer: differenceInCalendarDays(l.validade, hojeDate),
      })
      lotesPorVariacao.set(l.variacaoId, arr)
    }
    variacoes = produto.variacoes.map((v) => {
      const ativa = promocaoAtiva(v, hojeDate)
      return {
        id: v.id,
        nome: v.nome,
        precoVenda: precoEfetivo(v, hojeDate).toFixed(2),
        precoOriginal: ativa ? v.precoVenda.toFixed(2) : null,
        emPromocao: ativa,
        lotes: lotesPorVariacao.get(v.id) ?? [],
      }
    })
  } else {
    const componenteVariacaoIds = produto.kitItens.map((k) => k.componenteVariacaoId).filter((v): v is string => !!v)
    const livrePorVariacao = await estoqueLivrePorVariacao(componenteVariacaoIds)
    kitDisponivel = kitsMontaveis(produto.kitItens, livrePorVariacao)
  }

  // Igual ao card da vitrine: o "a partir de"/selo seguem a MESMA variação
  // que tem o menor preço vigente, pra não misturar promo de um sabor com
  // preço cheio de outro.
  const maisBarata =
    produto.tipo === 'UNITARIO'
      ? variacoes.reduce<VariacaoDisponivel | null>(
          (min, v) => (min === null || new Decimal(v.precoVenda).lessThan(min.precoVenda) ? v : min),
          null,
        )
      : null

  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao,
    categoria: produto.categoria,
    tipo: produto.tipo,
    precoVenda: maisBarata ? maisBarata.precoVenda : produto.precoVenda ? produto.precoVenda.toFixed(2) : '0.00',
    precoOriginal: maisBarata?.precoOriginal ?? null,
    precoAPartir: produto.tipo === 'UNITARIO' && variacoes.length > 1,
    emPromocao: maisBarata?.emPromocao ?? false,
    alergenicos: produto.alergenicos,
    fotos: produto.fotos.map((f) => f.path),
    variacoes,
    kitComponentes:
      produto.tipo === 'KIT'
        ? produto.kitItens.map((k) => ({
            nome: k.componente.nome,
            variacaoNome: k.componenteVariacao?.nome ?? null,
            qtde: k.qtde,
          }))
        : [],
    kitDisponivel,
  }
}
