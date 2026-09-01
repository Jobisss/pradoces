'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'

/**
 * Gestão de cliente pelo admin (/admin/clientes) — bônus/remoção manual de
 * pontos e marcação VIP. Complementa bloquearCliente/desbloquearCliente
 * (lib/actions/reservas-admin.ts), que continuam lá por já serem chamadas a
 * partir da tela de reservas.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type ClienteAdminActionState = { error?: string; ok?: boolean }

async function clientContext() {
  const h = await nextHeaders()
  return { ip: clientIp(h), ua: h.get('user-agent') ?? undefined }
}

/**
 * Ajuste manual de pontos (motivo AJUSTE_ADMIN — existia no enum desde a
 * Phase 4, nunca usado). Sem teto: a mãe pode dar bônus ou remover qualquer
 * quantidade, inclusive além do que ela mesma já deu de bônus (a pedido
 * dela — sem checagem de saldo aqui de propósito). Ledger imutável: isso
 * cria uma nova linha, nunca edita/apaga a anterior (mesmo padrão de
 * CANCELAMENTO/RESGATE_REJEITADO).
 */
export async function ajustarPontosAdmin(
  clienteId: string,
  valor: number,
  motivo?: string,
): Promise<ClienteAdminActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (!Number.isInteger(valor) || valor === 0) {
    return { error: 'Informa uma quantidade de pontos válida (número inteiro, diferente de zero).' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true } })
      await tx.pontosTransacao.create({
        data: { clienteId, valor, motivo: 'AJUSTE_ADMIN' },
      })
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: valor > 0 ? 'pontos_bonus_admin' : 'pontos_removidos_admin',
    entityType: 'user',
    entityId: clienteId,
    metadata: { valor, motivo: motivo?.trim() || undefined },
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/clientes')
  revalidatePath(`/admin/clientes/${clienteId}`)
  revalidatePath('/minha-conta/pontos')
  return { ok: true }
}

/** Marca/desmarca cliente como VIP — dá acesso a promoções marcadas como exclusivas (Variacao.promocaoVip). */
export async function alternarVip(clienteId: string, vip: boolean): Promise<ClienteAdminActionState> {
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
    await prisma.user.update({ where: { id: clienteId }, data: { isVip: vip } })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: vip ? 'cliente_marcado_vip' : 'cliente_desmarcado_vip',
    entityType: 'user',
    entityId: clienteId,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/clientes')
  revalidatePath(`/admin/clientes/${clienteId}`)
  return { ok: true }
}
