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
import { pontosDeVenda, expiracaoDoCredito } from '@/lib/pontos/calculo'

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
          itens: {
            select: {
              loteId: true,
              qtde: true,
              precoUnitarioCongelado: true,
              // Ponto é lastreado em lucro (PT-01) — precisa do custo
              // congelado daquele lote, não só do preço.
              lote: { select: { custoPorUnidadeCongelado: true } },
            },
          },
        },
      })
      if (!reserva) throw new ReservaAdminError(GENERIC_SERVER_ERROR)
      if (reserva.status !== 'PENDENTE') throw new ReservaAdminError(JA_PROCESSADA)

      const confirmadaEm = new Date()

      // Baixa de estoque é IGUAL nos dois tipos: o doce sai da prateleira do
      // mesmo jeito, tenha sido pago em reais ou em pontos. Resgate de item
      // nomeCustom (sem lote) e resgates antigos — anteriores ao ReservaItem
      // de resgate — têm `itens` vazio e passam batido aqui, de propósito.
      for (const item of reserva.itens) {
        // O UPDATE serializa contra outra transação concorrente na mesma
        // linha (Postgres bloqueia a row no primeiro UPDATE); os CHECKs
        // (qtde_disponivel/qtde_reservada >= 0) são a defesa final.
        await tx.lote.update({
          where: { id: item.loteId },
          data: { qtdeDisponivel: { decrement: item.qtde }, qtdeReservada: { decrement: item.qtde } },
        })
      }

      // RESGATE já debitou os pontos na hora do resgate (RESG-04) e não
      // credita nada de volta — trocar pontos por doce não gera pontos.
      if (reserva.tipo === 'RESGATE') {
        await tx.reserva.update({ where: { id: reservaId }, data: { status: 'CONFIRMADA', confirmadaEm } })
        return
      }

      const config = await tx.configuracao.findUnique({ where: { id: 1 } })
      const pontosPorReal = config?.pontosPorReal ?? new Decimal(1)
      const expiracaoMeses = config?.pontosExpiracaoMeses ?? 12

      const lucroTotal = reserva.itens.reduce(
        (soma, item) =>
          soma.plus(
            item.precoUnitarioCongelado
              .minus(item.lote.custoPorUnidadeCongelado)
              .times(item.qtde),
          ),
        new Decimal(0),
      )
      // Mesma conta da venda no balcão (lib/actions/lotes.ts) — ver lib/pontos/calculo.ts.
      const pontos = pontosDeVenda(lucroTotal, pontosPorReal)
      const expiraEm = expiracaoDoCredito(confirmadaEm, expiracaoMeses)

      // Reserva de convidado (sem cadastro) não credita pontos — só passa a
      // contar depois que a conta for vinculada (lib/auth/server.ts,
      // afterEmailVerification), e só pra confirmações feitas DEPOIS disso.
      if (reserva.clienteId && pontos > 0) {
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

      // Soft-hold volta pros dois tipos — resgate também segura lote agora.
      for (const item of reserva.itens) {
        await tx.lote.update({ where: { id: item.loteId }, data: { qtdeReservada: { decrement: item.qtde } } })
      }

      if (reserva.tipo === 'RESGATE') {
        // Resgate só existe pra cliente logado (lib/actions/resgate.ts sempre
        // exige requireCliente()) — reserva de convidado nunca é RESGATE.
        const debito = reserva.clienteId
          ? await tx.pontosTransacao.findFirst({ where: { reservaId: reserva.id, motivo: 'RESGATE' } })
          : null
        if (debito && reserva.clienteId) {
          await tx.pontosTransacao.create({
            data: {
              clienteId: reserva.clienteId,
              valor: -debito.valor,
              motivo: 'RESGATE_REJEITADO',
              reservaId: reserva.id,
            },
          })
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

/**
 * Cancela uma reserva já CONFIRMADA/AGUARDANDO_RETIRADA a pedido do cliente
 * (ex.: ligou avisando que não vai poder retirar) — devolve o estoque
 * (`qtdeDisponivel`, já que a confirmação decrementou de verdade) e estorna
 * pontos (crédito da confirmação, ou débito do resgate se for RESGATE), mesmo
 * espelho de `cancelarReserva` (lib/actions/reservas.ts, self-service do
 * cliente). PENDENTE já tem seu próprio botão ("Recusar" -> rejeitarReserva,
 * que só libera o soft-hold em qtdeReservada — nunca decrementou
 * qtdeDisponivel, não tem o que devolver aí). "Apagar reserva" continua
 * existindo pra lixo/duplicata/teste e continua NÃO revertendo nada de
 * propósito (ver comentário em apagarReserva) — esta é a ação certa quando o
 * pedido é cancelamento de verdade de algo já confirmado.
 */
export async function cancelarReservaAdmin(reservaId: string): Promise<ReservaAdminActionState> {
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
          itens: { select: { loteId: true, qtde: true } },
        },
      })
      if (!reserva) throw new ReservaAdminError(GENERIC_SERVER_ERROR)
      if (!['CONFIRMADA', 'AGUARDANDO_RETIRADA'].includes(reserva.status)) {
        throw new ReservaAdminError(JA_PROCESSADA)
      }

      // Estoque volta pros dois tipos — a confirmação decrementou nos dois.
      for (const item of reserva.itens) {
        await tx.lote.update({ where: { id: item.loteId }, data: { qtdeDisponivel: { increment: item.qtde } } })
      }

      if (reserva.tipo === 'RESGATE') {
        // Resgate só existe pra cliente logado — reserva de convidado nunca é RESGATE.
        const debito = reserva.clienteId
          ? await tx.pontosTransacao.findFirst({ where: { reservaId: reserva.id, motivo: 'RESGATE' } })
          : null
        if (debito && reserva.clienteId) {
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
        // Reserva de convidado (sem clienteId) nunca teve PontosTransacao — nada pra estornar.
        if (reserva.clienteId) {
          const creditos = await tx.pontosTransacao.findMany({
            where: { reservaId: reserva.id, motivo: 'RESERVA_CONFIRMADA' },
          })
          for (const credito of creditos) {
            await tx.pontosTransacao.create({
              data: {
                clienteId: reserva.clienteId,
                valor: -credito.valor,
                motivo: 'CANCELAMENTO',
                reservaId: reserva.id,
              },
            })
          }
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
    action: 'reserva_cancelada_admin',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  revalidatePath('/minha-conta/reservas')
  revalidatePath('/minha-conta/pontos')
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

/**
 * Apaga a reserva de vez (admin pediu explicitamente uma saída pra lixo/
 * duplicata/teste — dupla confirmação fica na UI). ReservaItem cai junto
 * (onDelete: Cascade); PontosTransacao só perde o vínculo (onDelete: SetNull)
 * — o ledger de pontos NUNCA é apagado, mesmo que a reserva que gerou o
 * crédito/débito suma, porque ele é o registro financeiro auditável.
 *
 * Se ainda tá PENDENTE, o soft-hold em `qtdeReservada`/o débito de pontos do
 * resgate não têm outro jeito de ser liberados (não há cascade pra counter
 * nem pra essa lógica) — por isso replica exatamente o estorno que
 * `rejeitarReserva` já faz, na mesma transação, antes do delete. Reservas já
 * confirmadas/retiradas representam venda real (estoque já baixado de
 * verdade); apagar a linha não desfaz a venda, só some com o registro.
 */
export async function apagarReserva(reservaId: string): Promise<ReservaAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  let snapshot: { status: string; tipo: string; clienteId: string | null } | null = null

  try {
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: reservaId },
        select: {
          id: true,
          status: true,
          tipo: true,
          clienteId: true,
          itens: { select: { loteId: true, qtde: true } },
        },
      })
      if (!reserva) throw new ReservaAdminError(GENERIC_SERVER_ERROR)
      snapshot = { status: reserva.status, tipo: reserva.tipo, clienteId: reserva.clienteId }

      if (reserva.status === 'PENDENTE') {
        // Soft-hold volta pros dois tipos — resgate também segura lote agora.
        for (const item of reserva.itens) {
          await tx.lote.update({ where: { id: item.loteId }, data: { qtdeReservada: { decrement: item.qtde } } })
        }

        if (reserva.tipo === 'RESGATE') {
          // Resgate só existe pra cliente logado — reserva de convidado nunca é RESGATE.
          const debito = reserva.clienteId
            ? await tx.pontosTransacao.findFirst({ where: { reservaId: reserva.id, motivo: 'RESGATE' } })
            : null
          if (debito && reserva.clienteId) {
            await tx.pontosTransacao.create({
              data: {
                clienteId: reserva.clienteId,
                valor: -debito.valor,
                motivo: 'RESGATE_REJEITADO',
                reservaId: reserva.id,
              },
            })
          }
        }
      }

      await tx.reserva.delete({ where: { id: reservaId } })
    })
  } catch (e) {
    if (e instanceof ReservaAdminError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'reserva_apagada',
    entityType: 'reserva',
    entityId: reservaId,
    metadata: snapshot ?? undefined,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  revalidatePath('/minha-conta/reservas')
  return { ok: true }
}

/**
 * Marca/desmarca "pago" numa reserva — puro checklist manual da mãe (pagamento
 * combinado fora do sistema, WhatsApp/pix na entrega, nunca cobrança online).
 * Não bloqueia nem afeta nenhum outro fluxo (confirmar, retirar, estoque,
 * pontos) — só ajuda a lembrar quem ainda deve.
 */
export async function marcarPago(reservaId: string, pago: boolean): Promise<ReservaAdminActionState> {
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
    await prisma.reserva.update({
      where: { id: reservaId },
      data: { pago, pagoEm: pago ? new Date() : null },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: pago ? 'reserva_marcada_paga' : 'reserva_desmarcada_paga',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/reservas')
  revalidatePath('/admin/painel-do-dia')
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
