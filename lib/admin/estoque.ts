import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'

export type EstoqueProduto = {
  produtoId: string
  variacaoId: string | null
  nome: string
  qtdeTotal: number
  /** Já prometido a alguém — o que sobra livre é qtdeTotal − qtdeReservada. */
  qtdeReservada: number
  /** Custo congelado parado nesse estoque (qtde × custo/un de cada lote). */
  custoParado: Decimal
  /** Unidades em lote que vence em ≤2 dias — é o que precisa sair primeiro. */
  qtdeVencendo: number
  vencendoEmBreve: boolean
  proximaValidade: string | null
}

/** ADM-05/D-13 — soma qtdeDisponivel entre lotes vigentes por VARIAÇÃO (sabor), flag de vencimento ≤2 dias. */
export async function snapshotEstoque(): Promise<EstoqueProduto[]> {
  const hoje = new Date(`${hojeSaoPaulo()}T00:00:00Z`)
  const em2Dias = new Date(hoje)
  em2Dias.setUTCDate(em2Dias.getUTCDate() + 2)

  const lotes = await prisma.lote.findMany({
    where: { validade: { gte: hoje }, qtdeDisponivel: { gt: 0 } },
    select: {
      produtoId: true,
      variacaoId: true,
      qtdeDisponivel: true,
      qtdeReservada: true,
      custoPorUnidadeCongelado: true,
      validade: true,
      produto: { select: { nome: true } },
      variacao: { select: { nome: true } },
    },
    orderBy: { validade: 'asc' },
  })

  const porChave = new Map<string, EstoqueProduto>()
  for (const l of lotes) {
    const chave = `${l.produtoId}:${l.variacaoId ?? ''}`
    const nome = l.variacao ? `${l.produto.nome} — ${l.variacao.nome}` : l.produto.nome
    const atual = porChave.get(chave)
    const vence = l.validade <= em2Dias
    const custoLote = new Decimal(l.custoPorUnidadeCongelado.toString()).times(l.qtdeDisponivel)
    if (!atual) {
      porChave.set(chave, {
        produtoId: l.produtoId,
        variacaoId: l.variacaoId,
        nome,
        qtdeTotal: l.qtdeDisponivel,
        qtdeReservada: l.qtdeReservada,
        custoParado: custoLote,
        qtdeVencendo: vence ? l.qtdeDisponivel : 0,
        vencendoEmBreve: vence,
        proximaValidade: l.validade.toISOString(),
      })
    } else {
      atual.qtdeTotal += l.qtdeDisponivel
      atual.qtdeReservada += l.qtdeReservada
      atual.custoParado = atual.custoParado.plus(custoLote)
      if (vence) atual.qtdeVencendo += l.qtdeDisponivel
      atual.vencendoEmBreve = atual.vencendoEmBreve || vence
    }
  }

  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}
