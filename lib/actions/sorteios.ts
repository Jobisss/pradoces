'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { SorteioSchema } from '@/lib/validation/sorteios'

/** Sorteios (SORT-01/02), admin-only. Foto fica pra depois — campo existe no schema, sem UI ainda. */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type SorteioActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
}

async function clientContext() {
  const h = await nextHeaders()
  return { ip: clientIp(h) }
}

export async function criarSorteio(input: unknown): Promise<SorteioActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = SorteioSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const prazo = new Date(parsed.data.prazo)
  if (prazo <= new Date()) {
    return { error: 'O prazo precisa ser no futuro.', fieldErrors: { prazo: ['O prazo precisa ser no futuro.'] } }
  }

  let sorteio: { id: string }
  try {
    sorteio = await prisma.sorteio.create({
      data: {
        nome: parsed.data.nome,
        premio: parsed.data.premio,
        custoPontos: parsed.data.custoPontos,
        capPorCliente: parsed.data.capPorCliente,
        prazo,
      },
      select: { id: true },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/sorteios')
  return { ok: true, id: sorteio.id }
}

export async function editarSorteio(id: string, input: unknown): Promise<SorteioActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const atual = await prisma.sorteio.findUnique({ where: { id }, select: { status: true } })
  if (!atual) return { error: GENERIC_SERVER_ERROR }
  if (atual.status !== 'ABERTO') return { error: 'Esse sorteio já foi encerrado.' }

  const parsed = SorteioSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const prazo = new Date(parsed.data.prazo)
  if (prazo <= new Date()) {
    return { error: 'O prazo precisa ser no futuro.', fieldErrors: { prazo: ['O prazo precisa ser no futuro.'] } }
  }

  try {
    await prisma.sorteio.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        premio: parsed.data.premio,
        custoPontos: parsed.data.custoPontos,
        capPorCliente: parsed.data.capPorCliente,
        prazo,
      },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/sorteios')
  return { ok: true, id }
}
