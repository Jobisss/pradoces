import 'server-only'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'

export type EstoqueProduto = {
  produtoId: string
  nome: string
  qtdeTotal: number
  vencendoEmBreve: boolean
  proximaValidade: string | null
}

/** ADM-05 — soma qtdeDisponivel entre lotes vigentes por produto, flag de vencimento ≤2 dias. */
export async function snapshotEstoque(): Promise<EstoqueProduto[]> {
  const hoje = new Date(`${hojeSaoPaulo()}T00:00:00Z`)
  const em2Dias = new Date(hoje)
  em2Dias.setUTCDate(em2Dias.getUTCDate() + 2)

  const lotes = await prisma.lote.findMany({
    where: { validade: { gte: hoje }, qtdeDisponivel: { gt: 0 } },
    select: { produtoId: true, qtdeDisponivel: true, validade: true, produto: { select: { nome: true } } },
    orderBy: { validade: 'asc' },
  })

  const porProduto = new Map<string, EstoqueProduto>()
  for (const l of lotes) {
    const atual = porProduto.get(l.produtoId)
    const vence = l.validade <= em2Dias
    if (!atual) {
      porProduto.set(l.produtoId, {
        produtoId: l.produtoId,
        nome: l.produto.nome,
        qtdeTotal: l.qtdeDisponivel,
        vencendoEmBreve: vence,
        proximaValidade: l.validade.toISOString(),
      })
    } else {
      atual.qtdeTotal += l.qtdeDisponivel
      atual.vencendoEmBreve = atual.vencendoEmBreve || vence
    }
  }

  return [...porProduto.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}
