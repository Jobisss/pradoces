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

/** Admin (RES-06/07/13/14) — anti N+1: cliente + itens + no-shows num batch. */
export async function listarReservasAdmin(filtro: FiltroReserva) {
  const reservas = await prisma.reserva.findMany({
    where: { status: { in: STATUS_POR_FILTRO[filtro] } },
    include: {
      cliente: { select: { id: true, name: true, email: true, telefone: true, banned: true, banReason: true } },
      itens: { include: { lote: { select: { validade: true, produto: { select: { nome: true } } } } } },
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

  return reservas.map((r) => ({ ...r, noShowsDoCliente: noShowPorCliente.get(r.clienteId) ?? 0 }))
}

/** RES-10 — comprovante público: sem login, só o token não-sequencial protege. */
export async function buscarReservaPorToken(token: string) {
  return prisma.reserva.findUnique({
    where: { token },
    select: {
      id: true,
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
    },
  })
}
