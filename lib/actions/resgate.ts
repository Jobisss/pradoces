'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireCliente } from '@/lib/auth/require-cliente'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { saldoPontos } from '@/lib/pontos/queries'

/**
 * Resgate (RESG-03/04/05), cliente autenticado. Débito de pontos é
 * IMEDIATO (diferente da reserva normal, que credita só na confirmação) —
 * cria uma Reserva tipo RESGATE que a mãe ainda confirma manualmente
 * (lib/actions/reservas-admin.ts trata os dois tipos).
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

class ResgateError extends Error {}

export type ResgateActionState = { error?: string; ok?: boolean; token?: string }

export async function resgatarItem(
  itemResgatavelId: string,
  janelaRetirada: string,
  observacao?: string,
): Promise<ResgateActionState> {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let cliente: Awaited<ReturnType<typeof requireCliente>>
  try {
    cliente = await requireCliente()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (!janelaRetirada.trim()) return { error: 'Diz quando prefere retirar.' }

  let resultado: { id: string; token: string }
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const item = await tx.itemResgatavel.findUnique({
        where: { id: itemResgatavelId },
        select: { id: true, ativo: true, custoPontos: true, produtoId: true },
      })
      if (!item || !item.ativo) throw new ResgateError('Esse item não está mais disponível.')

      if (item.produtoId) {
        const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
        const temEstoque = await tx.lote.findFirst({
          where: {
            produtoId: item.produtoId,
            validade: { gte: new Date(`${hoje}T00:00:00Z`) },
            qtdeDisponivel: { gt: 0 },
          },
          select: { id: true },
        })
        if (!temEstoque) throw new ResgateError('Esse item acabou de esgotar.')
      }

      const saldo = await saldoPontos(cliente.id)
      if (saldo < item.custoPontos) throw new ResgateError('Você não tem pontos suficientes pra esse resgate.')

      const reserva = await tx.reserva.create({
        data: {
          clienteId: cliente.id,
          tipo: 'RESGATE',
          itemResgatavelId: item.id,
          janelaRetirada: janelaRetirada.trim(),
          observacao: observacao?.trim() || undefined,
        },
        select: { id: true, token: true },
      })

      await tx.pontosTransacao.create({
        data: { clienteId: cliente.id, valor: -item.custoPontos, motivo: 'RESGATE', reservaId: reserva.id },
      })

      return reserva
    })
  } catch (e) {
    if (e instanceof ResgateError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/minha-conta/pontos')
  revalidatePath('/minha-conta/reservas')
  revalidatePath('/admin/reservas')
  return { ok: true, token: resultado.token }
}
