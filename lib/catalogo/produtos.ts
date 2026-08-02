import 'server-only'
import { differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'

/**
 * Queries do catálogo PÚBLICO (CAT-01..05). Diferença crítica pras queries
 * de admin: `select` explícito que NUNCA inclui custo/margem (custoTotalCongelado,
 * custoPorUnidadeCongelado, custoGasCongelado, tudo em Ingrediente/Compra) —
 * esse dado é só da mãe, vazar aqui seria expor markup pro cliente final.
 */

export type ProdutoCard = {
  id: string
  nome: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  precoVenda: string
  capaPath: string | null
  disponivel: boolean
  emCampanha: boolean
}

function inicioDoDiaSaoPaulo(): Date {
  return new Date(`${hojeSaoPaulo()}T00:00:00Z`)
}

/** produtoIds de UNITARIO com pelo menos 1 lote vigente com qtde disponível. */
async function idsComEstoque(): Promise<Set<string>> {
  const lotes = await prisma.lote.findMany({
    where: { validade: { gte: inicioDoDiaSaoPaulo() }, qtdeDisponivel: { gt: 0 } },
    select: { produtoId: true },
    distinct: ['produtoId'],
  })
  return new Set(lotes.map((l) => l.produtoId))
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
      kitItens: { select: { componenteId: true } },
      campanhas: { select: { campanhaId: true } },
    },
    orderBy: { nome: 'asc' },
  })

  const disponiveis = await idsComEstoque()

  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    tipo: p.tipo,
    precoVenda: p.precoVenda.toFixed(2),
    capaPath: p.fotos[0]?.path ?? null,
    disponivel:
      p.tipo === 'UNITARIO'
        ? disponiveis.has(p.id)
        : p.kitItens.length > 0 && p.kitItens.every((k) => disponiveis.has(k.componenteId)),
    emCampanha: p.campanhas.length > 0,
  }))
}

export type LoteDisponivel = { id: string; validade: string; qtdeDisponivel: number; diasParaVencer: number }

export type ProdutoDetalhe = {
  id: string
  nome: string
  descricao: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  precoVenda: string
  alergenicos: string[]
  fotos: string[]
  lotes: LoteDisponivel[]
  kitComponentes: Array<{ nome: string; qtde: number }>
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
      kitItens: { select: { qtde: true, componente: { select: { nome: true } } } },
    },
  })
  if (!produto || !produto.ativo) return null

  let lotes: LoteDisponivel[] = []
  if (produto.tipo === 'UNITARIO') {
    const hojeDate = inicioDoDiaSaoPaulo()
    const rows = await prisma.lote.findMany({
      where: { produtoId: id, validade: { gte: hojeDate }, qtdeDisponivel: { gt: 0 } },
      select: { id: true, validade: true, qtdeDisponivel: true },
      orderBy: { validade: 'asc' },
    })
    lotes = rows.map((l) => ({
      id: l.id,
      validade: l.validade.toISOString(),
      qtdeDisponivel: l.qtdeDisponivel,
      diasParaVencer: differenceInCalendarDays(l.validade, hojeDate),
    }))
  }

  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao,
    categoria: produto.categoria,
    tipo: produto.tipo,
    precoVenda: produto.precoVenda.toFixed(2),
    alergenicos: produto.alergenicos,
    fotos: produto.fotos.map((f) => f.path),
    lotes,
    kitComponentes:
      produto.tipo === 'KIT' ? produto.kitItens.map((k) => ({ nome: k.componente.nome, qtde: k.qtde })) : [],
  }
}
