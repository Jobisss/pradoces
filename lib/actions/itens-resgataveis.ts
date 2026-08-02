'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { ItemResgatavelSchema } from '@/lib/validation/itens-resgataveis'

/** Catálogo de resgate (RESG-01/02/07), admin-only. */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type ItemResgatavelActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
}

async function clientContext() {
  const h = await nextHeaders()
  return { ip: clientIp(h) }
}

export async function criarItemResgatavel(input: unknown): Promise<ItemResgatavelActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ItemResgatavelSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  let item: { id: string }
  try {
    item = await prisma.itemResgatavel.create({
      data: {
        produtoId: parsed.data.produtoId ?? null,
        nomeCustom: parsed.data.nomeCustom ?? null,
        custoPontos: parsed.data.custoPontos,
        ativo: parsed.data.ativo,
      },
      select: { id: true },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/resgates')
  return { ok: true, id: item.id }
}

export async function editarItemResgatavel(id: string, input: unknown): Promise<ItemResgatavelActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ItemResgatavelSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.itemResgatavel.update({
      where: { id },
      data: {
        produtoId: parsed.data.produtoId ?? null,
        nomeCustom: parsed.data.nomeCustom ?? null,
        custoPontos: parsed.data.custoPontos,
        ativo: parsed.data.ativo,
      },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/resgates')
  return { ok: true, id }
}
