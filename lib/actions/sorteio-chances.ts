'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireCliente } from '@/lib/auth/require-cliente'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { saldoPontos } from '@/lib/pontos/queries'

/** SORT-03 — comprar 1 chance, débito imediato, respeita o cap por cliente (SORT-02). */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

class ChanceError extends Error {}

export type ChanceActionState = { error?: string; ok?: boolean }

export async function comprarChance(sorteioId: string): Promise<ChanceActionState> {
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

  try {
    await prisma.$transaction(async (tx) => {
      const sorteio = await tx.sorteio.findUnique({
        where: { id: sorteioId },
        select: { id: true, status: true, prazo: true, custoPontos: true, capPorCliente: true },
      })
      if (!sorteio || sorteio.status !== 'ABERTO' || sorteio.prazo <= new Date()) {
        throw new ChanceError('Esse sorteio já encerrou.')
      }

      const minhasChances = await tx.sorteioChance.count({ where: { sorteioId, clienteId: cliente.id } })
      if (minhasChances >= sorteio.capPorCliente) {
        throw new ChanceError(`Você já tem o máximo de ${sorteio.capPorCliente} chance(s) nesse sorteio.`)
      }

      const saldo = await saldoPontos(cliente.id)
      if (saldo < sorteio.custoPontos) throw new ChanceError('Você não tem pontos suficientes.')

      await tx.sorteioChance.create({ data: { sorteioId, clienteId: cliente.id } })
      await tx.pontosTransacao.create({
        data: { clienteId: cliente.id, valor: -sorteio.custoPontos, motivo: 'SORTEIO', sorteioId },
      })
    })
  } catch (e) {
    if (e instanceof ChanceError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/minha-conta/sorteios')
  revalidatePath('/minha-conta/pontos')
  return { ok: true }
}
