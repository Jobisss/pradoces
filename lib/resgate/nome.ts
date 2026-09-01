/**
 * Nome legível de um item de resgate — "Produto — Sabor" quando ele aponta pro
 * catálogo, `nomeCustom` quando é item avulso.
 *
 * Existe porque a variação NÃO é decorativa: D-13 exige que um resgate ligado a
 * produto prometa um sabor específico (CHECK itens_resgataveis_variacao_com_produto
 * no banco). Mostrar só o nome do produto deixa a mãe sem saber qual sabor
 * separar quando o produto tem mais de uma variação. Centralizado num lugar só
 * porque a mesma string aparece na fila de reservas, no painel do dia, no
 * catálogo do admin, no catálogo do cliente e no relatório por cliente.
 */
export type ItemResgatavelNomeavel = {
  nomeCustom: string | null
  produto: { nome: string } | null
  variacao: { nome: string } | null
}

export function nomeItemResgatavel(item: ItemResgatavelNomeavel | null | undefined): string {
  if (!item) return '—'
  if (!item.produto) return item.nomeCustom ?? '—'
  return item.variacao ? `${item.produto.nome} — ${item.variacao.nome}` : item.produto.nome
}
