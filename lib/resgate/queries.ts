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
  // `qtde_disponivel > qtde_reservada`, não `> 0`: resgate faz soft-hold desde
  // lib/actions/resgate.ts, então unidade já prometida a outra pessoa não pode
  // continuar ofertada — senão o catálogo mostra disponível e o resgate falha
  // com "acabou de esgotar" no clique. Comparação entre duas colunas não sai
  // no findMany, daí o raw (mesma convenção do resto do projeto).
  const lotesDisponiveis = await prisma.$queryRaw<Array<{ variacao_id: string }>>`
    SELECT DISTINCT variacao_id
    FROM lotes
    WHERE variacao_id = ANY(${variacaoIds}::uuid[])
      AND validade >= ${new Date(`${hoje}T00:00:00Z`)}
      AND qtde_disponivel > qtde_reservada`
  const idsComEstoque = new Set(lotesDisponiveis.map((l) => l.variacao_id))

  return itens.filter((i) => !i.variacaoId || idsComEstoque.has(i.variacaoId))
}
