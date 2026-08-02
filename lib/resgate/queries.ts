import 'server-only'
import { prisma } from '@/lib/db/client'

/** Admin — todos os itens, ativos ou não (ela precisa ver tudo pra reativar/editar). */
export async function listarItensResgataveisAdmin() {
  return prisma.itemResgatavel.findMany({
    include: { produto: { select: { id: true, nome: true, precoVenda: true } } },
    orderBy: { criadoEm: 'desc' },
  })
}

/**
 * Catálogo público de resgate (RESG-06) — só ativo, e quando linkado a um
 * produto, só se esse produto tiver estoque disponível agora (mesma lógica
 * de disponibilidade do catálogo público normal). Item nomeCustom não tem
 * noção de estoque — fica visível até a mãe desativar manualmente.
 */
export async function listarItensResgataveisDisponiveis() {
  const itens = await prisma.itemResgatavel.findMany({
    where: { ativo: true },
    include: { produto: { select: { id: true, nome: true } } },
    orderBy: { custoPontos: 'asc' },
  })

  const produtoIds = itens.flatMap((i) => (i.produtoId ? [i.produtoId] : []))
  if (produtoIds.length === 0) return itens

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const lotesDisponiveis = await prisma.lote.findMany({
    where: {
      produtoId: { in: produtoIds },
      validade: { gte: new Date(`${hoje}T00:00:00Z`) },
      qtdeDisponivel: { gt: 0 },
    },
    select: { produtoId: true },
    distinct: ['produtoId'],
  })
  const idsComEstoque = new Set(lotesDisponiveis.map((l) => l.produtoId))

  return itens.filter((i) => !i.produtoId || idsComEstoque.has(i.produtoId))
}
