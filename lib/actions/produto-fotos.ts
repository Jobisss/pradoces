'use server'

import path from 'node:path'
import { rm } from 'node:fs/promises'
import { revalidatePath } from 'next/cache'
import { headers as nextHeaders } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'

/**
 * Fotos de produto (PROD-04/05), admin-only. O upload em si (sharp + 3
 * tamanhos WebP) é um Route Handler, não Server Action — ver
 * lib/uploads/produto-foto.ts pro motivo (limite de 1mb do bodySizeLimit).
 * Remover/reordenar continuam Server Actions normais (payload é só JSON).
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type FotoActionState = { error?: string; ok?: boolean }

async function clientContext() {
  const h = await nextHeaders()
  return { ip: clientIp(h) }
}

export async function removerFotoProduto(fotoId: string): Promise<FotoActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const foto = await prisma.produtoFoto.findUnique({ where: { id: fotoId } })
  if (!foto) return { error: GENERIC_SERVER_ERROR }

  try {
    await rm(path.join(process.cwd(), 'public', 'uploads', foto.path.split('/').slice(0, -1).join('/')), {
      recursive: true,
      force: true,
    })
  } catch {
    // best-effort: se o arquivo já sumiu do disco, a limpeza do DB continua.
  }

  const restantes = await prisma.produtoFoto.findMany({
    where: { produtoId: foto.produtoId, id: { not: fotoId } },
    orderBy: { ordem: 'asc' },
  })

  try {
    await prisma.$transaction([
      prisma.produtoFoto.delete({ where: { id: fotoId } }),
      // Renumera em duas fases pra não colidir com a @@unique([produtoId, ordem])
      // quando uma foto do meio é removida (ex.: 0,1,2 remove 0 -> vira 0,1).
      ...restantes.map((f, i) => prisma.produtoFoto.update({ where: { id: f.id }, data: { ordem: -(i + 1) } })),
      ...restantes.map((f, i) => prisma.produtoFoto.update({ where: { id: f.id }, data: { ordem: i } })),
    ])
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath(`/admin/produtos/${foto.produtoId}/editar`)
  revalidatePath(`/produtos/${foto.produtoId}`)
  revalidatePath('/')
  return { ok: true }
}

export async function reordenarFotosProduto(produtoId: string, idsEmOrdem: string[]): Promise<FotoActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const fotos = await prisma.produtoFoto.findMany({ where: { produtoId } })
  if (fotos.length !== idsEmOrdem.length || !fotos.every((f) => idsEmOrdem.includes(f.id))) {
    return { error: GENERIC_SERVER_ERROR }
  }

  try {
    await prisma.$transaction([
      ...idsEmOrdem.map((id, i) => prisma.produtoFoto.update({ where: { id }, data: { ordem: -(i + 1) } })),
      ...idsEmOrdem.map((id, i) => prisma.produtoFoto.update({ where: { id }, data: { ordem: i } })),
    ])
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath(`/admin/produtos/${produtoId}/editar`)
  revalidatePath(`/produtos/${produtoId}`)
  return { ok: true }
}
