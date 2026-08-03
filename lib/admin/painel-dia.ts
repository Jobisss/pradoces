import 'server-only'
import { prisma } from '@/lib/db/client'

/**
 * ADM-02/03 — reservas ainda não retiradas, agrupadas por `janelaRetirada`
 * (texto livre — não existe horário estruturado, ver nota em
 * lib/actions/reservas.ts sobre RES-08). Serve tanto a tela quanto a lista
 * de separação impressa (mesma query, a página só troca o CSS pra impressão
 * em vez de gerar um PDF em servidor).
 */
export type ItemSeparacao = { nome: string; qtde: number }

export type ReservaDoDia = {
  id: string
  status: string
  clienteNome: string
  clienteTelefone: string | null
  observacao: string | null
  itens: ItemSeparacao[]
}

export type GrupoJanela = { janela: string; reservas: ReservaDoDia[] }

export async function painelDoDia(): Promise<GrupoJanela[]> {
  const reservas = await prisma.reserva.findMany({
    where: { status: { in: ['PENDENTE', 'CONFIRMADA', 'AGUARDANDO_RETIRADA'] } },
    select: {
      id: true,
      status: true,
      janelaRetirada: true,
      observacao: true,
      cliente: { select: { name: true, telefone: true } },
      itens: { select: { qtde: true, lote: { select: { produto: { select: { nome: true } } } } } },
      itemResgatavel: { select: { nomeCustom: true, produto: { select: { nome: true } } } },
    },
    orderBy: [{ janelaRetirada: 'asc' }, { criadoEm: 'asc' }],
  })

  const grupos = new Map<string, ReservaDoDia[]>()
  for (const r of reservas) {
    const itens: ItemSeparacao[] =
      r.itens.length > 0
        ? r.itens.map((i) => ({ nome: i.lote.produto.nome, qtde: i.qtde }))
        : [{ nome: r.itemResgatavel?.produto?.nome ?? r.itemResgatavel?.nomeCustom ?? '—', qtde: 1 }]

    const entry: ReservaDoDia = {
      id: r.id,
      status: r.status,
      clienteNome: r.cliente.name,
      clienteTelefone: r.cliente.telefone,
      observacao: r.observacao,
      itens,
    }

    if (!grupos.has(r.janelaRetirada)) grupos.set(r.janelaRetirada, [])
    grupos.get(r.janelaRetirada)!.push(entry)
  }

  return [...grupos.entries()].map(([janela, reservas]) => ({ janela, reservas }))
}
