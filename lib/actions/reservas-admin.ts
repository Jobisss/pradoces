'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { auth } from '@/lib/auth/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'

/**
 * Confirmação de reserva (RES-06/07/13/14, PT-01..04), admin-only — o
 * coração da fase. Em transação atômica: decrementa qtde_disponivel
 * (a venda de fato acontece aqui, não na criação da reserva), libera
 * qtde_reservada (some o soft hold), credita pontos no ledger (cap +
 * expiração configuráveis). Pontos só entram AQUI, nunca na criação
 * (PT-02, anti-farm).
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const JA_PROCESSADA = 'Essa reserva já foi processada — recarrega a página.'

class ReservaAdminError extends Error {}

export type ReservaAdminActionState = { error?: string; ok?: boolean }

async function clientContext() {
  const h = await nextHeaders()
  return { ip: clientIp(h), ua: h.get('user-agent') ?? undefined }
}

export async function confirmarReserva(reservaId: string): Promise<ReservaAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: reservaId },
        select: {
          id: true,
          status: true,
          tipo: true,
          clienteId: true,
          itens: { select: { loteId: true, qtde: true, precoUnitarioCongelado: true } },
        },
      })
      if (!reserva) throw new ReservaAdminError(GENERIC_SERVER_ERROR)
      if (reserva.status !== 'PENDENTE') throw new ReservaAdminError(JA_PROCESSADA)

      const confirmadaEm = new Date()

      // RESGATE já debitou os pontos na hora do resgate (RESG-04) e não tem
      // ReservaItem/lote — confirmar é só virar o status.
      if (reserva.tipo === 'RESGATE') {
        await tx.reserva.update({ where: { id: reservaId }, data: { status: 'CONFIRMADA', confirmadaEm } })
        return
      }

      for (const item of reserva.itens) {
        // O UPDATE serializa contra outra transação concorrente na mesma
        // linha (Postgres bloqueia a row no primeiro UPDATE); os CHECKs
        // (qtde_disponivel/qtde_reservada >= 0) são a defesa final.
        await tx.lote.update({
          where: { id: item.loteId },
          data: { qtdeDisponivel: { decrement: item.qtde }, qtdeReservada: { decrement: item.qtde } },
        })
      }

      const config = await tx.configuracao.findUnique({ where: { id: 1 } })
      const pontosPorReal = config?.pontosPorReal ?? new Decimal(1)
      const cap = config?.pontosCapPorReserva ?? 500
      const expiracaoMeses = config?.pontosExpiracaoMeses ?? 12

      const valorTotal = reserva.itens.reduce(
        (soma, item) => soma.plus(item.precoUnitarioCongelado.times(item.qtde)),
        new Decimal(0),
      )
      const pontosCalculados = valorTotal.times(pontosPorReal).floor()
      const pontos = Decimal.min(pontosCalculados, cap).toNumber()

      const expiraEm = new Date(confirmadaEm)
      expiraEm.setMonth(expiraEm.getMonth() + expiracaoMeses)

      if (pontos > 0) {
        await tx.pontosTransacao.create({
          data: {
            clienteId: reserva.clienteId,
            valor: pontos,
            motivo: 'RESERVA_CONFIRMADA',
            reservaId: reserva.id,
            expiraEm,
          },
        })
      }

      await tx.reserva.update({ where: { id: reservaId }, data: { status: 'CONFIRMADA', confirmadaEm } })
    })
  } catch (e) {
    if (e instanceof ReservaAdminError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'reserva_confirmada',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
    rawUa: ua,
  })

  // NOTIF-01/02/08: comprovante atualizado + pontos creditados pro cliente,
  // aviso pra mãe — enfileirado fora da transação (RES-15). Envio real
  // depende do Resend configurado (tarefa de notificações à parte).

  revalidatePath('/admin/reservas')
  revalidatePath('/minha-conta/reservas')
  revalidatePath('/minha-conta/pontos')
  return { ok: true }
}

/** Admin recusa uma reserva ainda PENDENTE (ex.: não vai dar pra atender) — libera o soft hold. */
export async function rejeitarReserva(reservaId: string): Promise<ReservaAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: reservaId },
        select: {
          id: true,
          status: true,
          tipo: true,
          clienteId: true,
          itemResgatavelId: true,
          itens: { select: { loteId: true, qtde: true } },
        },
      })
      if (!reserva) throw new ReservaAdminError(GENERIC_SERVER_ERROR)
      if (reserva.status !== 'PENDENTE') throw new ReservaAdminError(JA_PROCESSADA)

      if (reserva.tipo === 'RESGATE') {
        // RESG-05 — estorna os pontos debitados no resgate, com um crédito
        // compensatório (nunca edita o débito original).
        const debito = await tx.pontosTransacao.findFirst({
          where: { reservaId: reserva.id, motivo: 'RESGATE' },
        })
        if (debito) {
          await tx.pontosTransacao.create({
            data: {
              clienteId: reserva.clienteId,
              valor: -debito.valor,
              motivo: 'RESGATE_REJEITADO',
              reservaId: reserva.id,
            },
          })
        }
      } else {
        for (const item of reserva.itens) {
          await tx.lote.update({ where: { id: item.loteId }, data: { qtdeReservada: { decrement: item.qtde } } })
        }
      }

      await tx.reserva.update({ where: { id: reservaId }, data: { status: 'CANCELADA', canceladaEm: new Date() } })
    })
  } catch (e) {
    if (e instanceof ReservaAdminError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'reserva_rejeitada',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  revalidatePath('/minha-conta/reservas')
  return { ok: true }
}

const PROXIMO_STATUS = { CONFIRMADA: 'AGUARDANDO_RETIRADA', AGUARDANDO_RETIRADA: 'RETIRADA' } as const

/** Avança CONFIRMADA -> AGUARDANDO_RETIRADA -> RETIRADA — sem side-effect em estoque/pontos (já resolvidos na confirmação). */
export async function avancarStatusReserva(reservaId: string): Promise<ReservaAdminActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const reserva = await prisma.reserva.findUnique({ where: { id: reservaId }, select: { status: true } })
  if (!reserva) return { error: GENERIC_SERVER_ERROR }
  const proximo = PROXIMO_STATUS[reserva.status as keyof typeof PROXIMO_STATUS]
  if (!proximo) return { error: JA_PROCESSADA }

  await prisma.reserva.update({
    where: { id: reservaId },
    data: { status: proximo, ...(proximo === 'RETIRADA' ? { retiradaEm: new Date() } : {}) },
  })

  revalidatePath('/admin/reservas')
  return { ok: true }
}

/** Marca como não-retirada (RES-13 alimenta o histórico mostrado na próxima confirmação desse cliente). */
export async function marcarNoShow(reservaId: string): Promise<ReservaAdminActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const reserva = await prisma.reserva.findUnique({ where: { id: reservaId }, select: { status: true } })
  if (!reserva || !['CONFIRMADA', 'AGUARDANDO_RETIRADA'].includes(reserva.status)) {
    return { error: JA_PROCESSADA }
  }

  await prisma.reserva.update({ where: { id: reservaId }, data: { status: 'NO_SHOW' } })
  revalidatePath('/admin/reservas')
  return { ok: true }
}

/** RES-14 — bloqueia/desbloqueia cliente via o plugin admin do Better Auth (banned/banReason já existiam). */
export async function bloquearCliente(clienteId: string, motivo: string): Promise<ReservaAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }
  if (!motivo.trim()) return { error: 'Explica o motivo do bloqueio.' }

  try {
    await auth.api.banUser({ headers: await nextHeaders(), body: { userId: clienteId, banReason: motivo.trim() } })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'cliente_bloqueado',
    entityType: 'user',
    entityId: clienteId,
    metadata: { motivo: motivo.trim() },
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  return { ok: true }
}

export async function desbloquearCliente(clienteId: string): Promise<ReservaAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  try {
    await auth.api.unbanUser({ headers: await nextHeaders(), body: { userId: clienteId } })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'cliente_desbloqueado',
    entityType: 'user',
    entityId: clienteId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  return { ok: true }
}
