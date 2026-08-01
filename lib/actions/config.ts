'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { ConfigSchema } from '@/lib/validation/config'

/** Config singleton (D-10) — margem mínima global, admin-only. */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type ConfigActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  message?: string
}

export async function salvarMargemGlobal(
  _prev: unknown,
  formData: FormData,
): Promise<ConfigActionState> {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ConfigSchema.safeParse({
    margemMinimaPadrao: String(formData.get('margemMinimaPadrao') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.configuracao.upsert({
      where: { id: 1 },
      create: { id: 1, margemMinimaPadrao: parsed.data.margemMinimaPadrao.toFixed(2) },
      update: { margemMinimaPadrao: parsed.data.margemMinimaPadrao.toFixed(2) },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/produtos')
  revalidatePath('/admin/ajustes')
  return { ok: true, message: 'Salvo!' }
}
