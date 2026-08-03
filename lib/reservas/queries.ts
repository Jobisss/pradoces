import 'server-only'
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
      itens: { include: { lote: { select: { validade: true, produto: { select: { nome: true } } } } } },
      itemResgatavel: { select: { nomeCustom: true, custoPontos: true, produto: { select: { nome: true } } } },
    },
    orderBy: { criadoEm: filtro === 'pendentes' ? 'asc' : 'desc' },
  })

  const clienteIds = [...new Set(reservas.map((r) => r.clienteId))]

  const noShows = await prisma.reserva.groupBy({
    by: ['clienteId'],
    where: { clienteId: { in: clienteIds }, status: 'NO_SHOW' },
    _count: { _all: true },
  })
  const noShowPorCliente = new Map(noShows.map((n) => [n.clienteId, n._count._all]))

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
    const atual = historicoPorCliente.get(r.clienteId) ?? { totalReservas: 0, valorTotal: 0, noShows: 0 }
    atual.totalReservas += 1
    atual.valorTotal += r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0)
    historicoPorCliente.set(r.clienteId, atual)
  }
  for (const [clienteId, count] of noShowPorCliente) {
    const atual = historicoPorCliente.get(clienteId) ?? { totalReservas: 0, valorTotal: 0, noShows: 0 }
    atual.noShows = count
    historicoPorCliente.set(clienteId, atual)
  }

  return reservas.map((r) => ({
    ...r,
    noShowsDoCliente: noShowPorCliente.get(r.clienteId) ?? 0,
    historicoCliente: historicoPorCliente.get(r.clienteId) ?? { totalReservas: 0, valorTotal: 0, noShows: 0 },
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
      janelaRetirada: true,
      observacao: true,
      criadoEm: true,
      token: true,
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { validade: true, produto: { select: { nome: true } } } },
        },
      },
      itemResgatavel: { select: { nomeCustom: true, custoPontos: true, produto: { select: { nome: true } } } },
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
      tipo: true,
      status: true,
      janelaRetirada: true,
      observacao: true,
      criadoEm: true,
      confirmadaEm: true,
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { validade: true, produto: { select: { nome: true } } } },
        },
      },
      itemResgatavel: { select: { nomeCustom: true, custoPontos: true, produto: { select: { nome: true } } } },
    },
  })
}
