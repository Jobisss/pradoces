import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import type { ReservaStatus } from '@prisma/client'

export const FILTROS_RESERVA = ['pendentes', 'confirmadas', 'historico'] as const
export type FiltroReserva = (typeof FILTROS_RESERVA)[number]

const STATUS_POR_FILTRO: Record<FiltroReserva, ReservaStatus[]> = {
  pendentes: ['PENDENTE'],
  confirmadas: ['CONFIRMADA', 'AGUARDANDO_RETIRADA'],
  historico: ['RETIRADA', 'CANCELADA', 'NO_SHOW'],
}

/** ADM-06 — histórico do cliente pra tela de confirmação (reservas anteriores, valor total, no-shows). */
export type HistoricoCliente = { totalReservas: number; valorTotal: number; noShows: number }

/** Admin (RES-06/07/13/14, ADM-06) — anti N+1: cliente + itens + histórico num batch. */
export async function listarReservasAdmin(filtro: FiltroReserva) {
  const reservas = await prisma.reserva.findMany({
    where: { status: { in: STATUS_POR_FILTRO[filtro] } },
    include: {
      cliente: { select: { id: true, name: true, email: true, telefone: true, banned: true, banReason: true } },
      itens: {
        include: {
          lote: { select: { validade: true, produto: { select: { nome: true } }, variacao: { select: { nome: true } } } },
        },
      },
      itemResgatavel: {
        select: {
          nomeCustom: true,
          custoPontos: true,
          produto: { select: { nome: true } },
          // Sem a variação a mãe não sabe qual sabor separar (lib/resgate/nome.ts).
          variacao: { select: { nome: true } },
        },
      },
    },
    orderBy: { criadoEm: filtro === 'pendentes' ? 'asc' : 'desc' },
  })

  // Reserva de convidado (sem login) não tem clienteId — não entra no
  // histórico/no-show por cliente (não existe identidade pra agrupar).
  const clienteIds = [...new Set(reservas.map((r) => r.clienteId).filter((id): id is string => id !== null))]

  const noShows = await prisma.reserva.groupBy({
    by: ['clienteId'],
    where: { clienteId: { in: clienteIds }, status: 'NO_SHOW' },
    _count: { _all: true },
  })
  // clienteId nunca é null aqui — o where acima já filtra por clienteIds (não-nulos).
  const noShowPorCliente = new Map(noShows.map((n) => [n.clienteId!, n._count._all]))

  // Valor total não dá pra vir de groupBy (soma qtde*precoCongelado do item,
  // não uma coluna direta de Reserva) — volume pequeno, reduz em JS mesmo.
  const anteriores = await prisma.reserva.findMany({
    where: {
      clienteId: { in: clienteIds },
      tipo: 'PADRAO',
      status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] },
    },
    select: { clienteId: true, itens: { select: { qtde: true, precoUnitarioCongelado: true } } },
  })
  const historicoPorCliente = new Map<string, HistoricoCliente>()
  for (const r of anteriores) {
    // clienteId nunca é null aqui — o where acima já filtra por clienteIds (não-nulos).
    const clienteId = r.clienteId!
    const atual = historicoPorCliente.get(clienteId) ?? { totalReservas: 0, valorTotal: 0, noShows: 0 }
    atual.totalReservas += 1
    atual.valorTotal += r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0)
    historicoPorCliente.set(clienteId, atual)
  }
  for (const [clienteId, count] of noShowPorCliente) {
    const atual = historicoPorCliente.get(clienteId) ?? { totalReservas: 0, valorTotal: 0, noShows: 0 }
    atual.noShows = count
    historicoPorCliente.set(clienteId, atual)
  }

  return reservas.map((r) => ({
    ...r,
    noShowsDoCliente: (r.clienteId ? noShowPorCliente.get(r.clienteId) : undefined) ?? 0,
    historicoCliente: (r.clienteId ? historicoPorCliente.get(r.clienteId) : undefined) ?? {
      totalReservas: 0,
      valorTotal: 0,
      noShows: 0,
    },
  }))
}

/** Painel do cliente (RES-08/09) — só as próprias reservas. */
export async function listarReservasCliente(clienteId: string) {
  return prisma.reserva.findMany({
    where: { clienteId },
    select: {
      id: true,
      tipo: true,
      status: true,
      deliveryMode: true,
      enderecoEntrega: true,
      taxaEntregaCongelada: true,
      janelaRetirada: true,
      observacao: true,
      criadoEm: true,
      token: true,
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { validade: true, produto: { select: { nome: true } }, variacao: { select: { nome: true } } } },
        },
      },
      itemResgatavel: {
        select: {
          nomeCustom: true,
          custoPontos: true,
          produto: { select: { nome: true } },
          // Sem a variação a mãe não sabe qual sabor separar (lib/resgate/nome.ts).
          variacao: { select: { nome: true } },
        },
      },
    },
    orderBy: { criadoEm: 'desc' },
  })
}

/** RES-10 — comprovante público: sem login, só o token não-sequencial protege. */
export async function buscarReservaPorToken(token: string) {
  return prisma.reserva.findUnique({
    where: { token },
    select: {
      id: true,
      clienteId: true,
      nomeConvidado: true,
      telefoneConvidado: true,
      emailConvidado: true,
      tipo: true,
      status: true,
      deliveryMode: true,
      enderecoEntrega: true,
      taxaEntregaCongelada: true,
      janelaRetirada: true,
      observacao: true,
      criadoEm: true,
      confirmadaEm: true,
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { validade: true, produto: { select: { nome: true } }, variacao: { select: { nome: true } } } },
        },
      },
      itemResgatavel: {
        select: {
          nomeCustom: true,
          custoPontos: true,
          produto: { select: { nome: true } },
          // Sem a variação a mãe não sabe qual sabor separar (lib/resgate/nome.ts).
          variacao: { select: { nome: true } },
        },
      },
    },
  })
}

/**
 * ADM — "quem ainda me deve": reservas confirmadas/retiradas que a mãe ainda não
 * marcou como pagas, agrupadas por quem deve.
 *
 * `pago` é checklist manual (o pagamento é combinado no WhatsApp/pix, nunca pelo
 * site — ver schema.prisma), então este relatório é a única forma de ver o total
 * em aberto sem varrer a fila reserva por reserva.
 *
 * Resgate fica de fora: é pago em pontos, `pago` nunca é marcado nele. Cancelada
 * e não-retirada também: não há o que cobrar.
 *
 * Convidado (sem cadastro) também deve — cada reserva de convidado vira um grupo
 * próprio, porque sem clienteId não existe identidade pra somar duas reservas da
 * mesma pessoa com segurança (dois "Maria" podem ser duas Marias).
 */
export type GrupoAReceber = {
  chave: string
  clienteId: string | null
  nome: string
  contato: string | null
  total: Decimal
  reservas: Awaited<ReturnType<typeof buscarReservasAReceber>>
}

async function buscarReservasAReceber() {
  return prisma.reserva.findMany({
    where: {
      tipo: 'PADRAO',
      pago: false,
      status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] },
    },
    select: {
      id: true,
      token: true,
      status: true,
      criadoEm: true,
      janelaRetirada: true,
      deliveryMode: true,
      taxaEntregaCongelada: true,
      clienteId: true,
      nomeConvidado: true,
      telefoneConvidado: true,
      emailConvidado: true,
      cliente: { select: { id: true, name: true, telefone: true, email: true } },
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { produto: { select: { nome: true } }, variacao: { select: { nome: true } } } },
        },
      },
    },
    orderBy: { criadoEm: 'asc' },
  })
}

export function totalDaReserva(r: {
  itens: { qtde: number; precoUnitarioCongelado: Decimal }[]
  taxaEntregaCongelada: Decimal | null
}): Decimal {
  const produtos = r.itens.reduce((soma, i) => soma.plus(i.precoUnitarioCongelado.times(i.qtde)), new Decimal(0))
  return r.taxaEntregaCongelada ? produtos.plus(r.taxaEntregaCongelada) : produtos
}

export async function listarAReceber(): Promise<{ totalGeral: Decimal; grupos: GrupoAReceber[] }> {
  const reservas = await buscarReservasAReceber()

  const grupos = new Map<string, GrupoAReceber>()
  for (const r of reservas) {
    // Convidado não agrupa por pessoa: a chave é a própria reserva.
    const chave = r.clienteId ?? `convidado:${r.id}`
    const grupo = grupos.get(chave) ?? {
      chave,
      clienteId: r.clienteId,
      nome: r.cliente?.name ?? r.nomeConvidado ?? '—',
      contato: r.cliente?.telefone ?? r.telefoneConvidado ?? r.cliente?.email ?? r.emailConvidado ?? null,
      total: new Decimal(0),
      reservas: [],
    }
    grupo.total = grupo.total.plus(totalDaReserva(r))
    grupo.reservas.push(r)
    grupos.set(chave, grupo)
  }

  return {
    totalGeral: [...grupos.values()].reduce((soma, g) => soma.plus(g.total), new Decimal(0)),
    // Maior devedor primeiro — é a ordem em que ela vai querer cobrar.
    grupos: [...grupos.values()].sort((a, b) => b.total.comparedTo(a.total)),
  }
}
