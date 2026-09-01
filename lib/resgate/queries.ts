import 'server-only'
import { prisma } from '@/lib/db/client'

/** Admin — todos os itens, ativos ou não (ela precisa ver tudo pra reativar/editar). */
export async function listarItensResgataveisAdmin() {
  return prisma.itemResgatavel.findMany({
    include: {
      produto: { select: { id: true, nome: true, precoVenda: true } },
      // D-13: o item promete um SABOR específico, não "qualquer um do produto".
      // Sem isso o catálogo mostra dois itens com o mesmo nome e ninguém sabe
      // qual é qual (ver lib/resgate/nome.ts).
      variacao: { select: { id: true, nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
}

/**
 * Catálogo público de resgate (RESG-06) — só ativo, e quando linkado a um
 * produto, só se essa VARIAÇÃO tiver estoque disponível agora (mesma lógica de
 * disponibilidade do catálogo público normal). Item nomeCustom não tem noção de
 * estoque — fica visível até a mãe desativar manualmente.
 *
 * A checagem é por variação, não por produto: um item que promete "Brigadeiro —
 * Ninho" não pode continuar ofertado só porque sobrou "Brigadeiro — Morango" no
 * estoque. O CHECK itens_resgataveis_variacao_com_produto garante que todo item
 * com produtoId tem variacaoId, então dá pra chavear tudo por variação.
 */
export async function listarItensResgataveisDisponiveis() {
  const itens = await prisma.itemResgatavel.findMany({
    where: { ativo: true },
    include: {
      produto: { select: { id: true, nome: true } },
      variacao: { select: { id: true, nome: true } },
    },
    orderBy: { custoPontos: 'asc' },
  })

  const variacaoIds = itens.flatMap((i) => (i.variacaoId ? [i.variacaoId] : []))
  if (variacaoIds.length === 0) return itens

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const lotesDisponiveis = await prisma.lote.findMany({
    where: {
      variacaoId: { in: variacaoIds },
      validade: { gte: new Date(`${hoje}T00:00:00Z`) },
      qtdeDisponivel: { gt: 0 },
    },
    select: { variacaoId: true },
    distinct: ['variacaoId'],
  })
  const idsComEstoque = new Set(lotesDisponiveis.map((l) => l.variacaoId))

  return itens.filter((i) => !i.variacaoId || idsComEstoque.has(i.variacaoId))
}
