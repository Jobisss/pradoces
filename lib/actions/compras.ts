'use server'

import Decimal from 'decimal.js'
import { Prisma } from '@prisma/client'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { CompraSchema } from '@/lib/validation/compras'

/**
 * Compra de ingrediente, admin-only (ING-02/03/04/05, D-01..D-04). Cada
 * registro é o evento que os lotes referenciam (ING-04 append-only) — depois
 * do primeiro lote usar a compra, o trigger trg_compra_imutavel (02-01) é a
 * última defesa; a checagem EXISTS aqui vem primeiro pra dar copy amigável
 * em vez do erro cru do Postgres (Pitfall 7).
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const QTDE_INVALIDA = 'Esse número não parece certo. Confere a quantidade e o tamanho da embalagem.'
const COMPRA_IMUTAVEL =
  'Essa compra já foi usada num lote, então ela não pode mais mudar — é ela que garante o custo verdadeiro do que você já produziu.'

export type CompraActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  message?: string
  ok?: boolean
  item?: {
    id: string
    marca: string
    qtdeEmbalagens: string
    tamanhoEmbalagem: string
    precoTotal: string
  }
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const ua = h.get('user-agent') ?? undefined
  return { ip, ua }
}

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** D-04 — reusa a grafia já existente ('moça' -> 'Moça') via allowlist literal. */
async function canonicalize(campo: 'marca' | 'mercado', valor: string): Promise<string> {
  const v = normalizeLabel(valor)
  const [existing] = await prisma.$queryRaw<{ v: string }[]>`
    SELECT DISTINCT ${Prisma.raw(campo)} AS v FROM ingrediente_compras
    WHERE lower(${Prisma.raw(campo)}) = lower(${v}) LIMIT 1`
  return existing?.v ?? v
}

export async function registrarCompra(
  _prev: unknown,
  formData: FormData,
): Promise<CompraActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = CompraSchema.safeParse({
    ingredienteId: String(formData.get('ingredienteId') ?? ''),
    dataCompra: String(formData.get('dataCompra') ?? ''),
    mercado: String(formData.get('mercado') ?? ''),
    marca: String(formData.get('marca') ?? ''),
    qtdeEmbalagens: String(formData.get('qtdeEmbalagens') ?? ''),
    tamanhoEmbalagem: String(formData.get('tamanhoEmbalagem') ?? ''),
    precoPorEmbalagem: String(formData.get('precoPorEmbalagem') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const qtdeTotalBase = parsed.data.qtdeEmbalagens.times(parsed.data.tamanhoEmbalagem)
  if (qtdeTotalBase.isZero()) return { error: QTDE_INVALIDA }
  const precoTotal = parsed.data.qtdeEmbalagens.times(parsed.data.precoPorEmbalagem)
  const custoPorUnidadeBase = precoTotal.dividedBy(qtdeTotalBase)

  const marca = await canonicalize('marca', parsed.data.marca)
  const mercado = await canonicalize('mercado', parsed.data.mercado)

  let compra: { id: string }
  try {
    compra = await prisma.ingredienteCompra.create({
      data: {
        ingredienteId: parsed.data.ingredienteId,
        dataCompra: new Date(`${parsed.data.dataCompra}T00:00:00Z`),
        mercado,
        marca,
        qtdeEmbalagens: parsed.data.qtdeEmbalagens.toFixed(3),
        tamanhoEmbalagem: parsed.data.tamanhoEmbalagem.toFixed(3),
        precoPorEmbalagem: parsed.data.precoPorEmbalagem.toFixed(4),
        qtdeTotalBase: qtdeTotalBase.toFixed(3),
        precoTotal: precoTotal.toFixed(4),
        custoPorUnidadeBase: custoPorUnidadeBase.toFixed(6),
      },
      select: { id: true },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'compra_registrada',
    entityType: 'ingrediente_compra',
    entityId: compra.id,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/ingredientes')
  return {
    ok: true,
    message: 'Anotado!',
    item: {
      id: compra.id,
      marca,
      qtdeEmbalagens: parsed.data.qtdeEmbalagens.toFixed(0),
      tamanhoEmbalagem: parsed.data.tamanhoEmbalagem.toFixed(0),
      precoTotal: precoTotal.toFixed(4),
    },
  }
}

async function assertCompraEditavel(id: string): Promise<CompraActionState | null> {
  const usada = await prisma.loteUsoIngrediente.count({ where: { ingredienteCompraId: id } })
  if (usada > 0) return { error: COMPRA_IMUTAVEL }
  return null
}

export async function corrigirCompra(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<CompraActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const bloqueada = await assertCompraEditavel(id)
  if (bloqueada) return bloqueada

  const parsed = CompraSchema.safeParse({
    ingredienteId: String(formData.get('ingredienteId') ?? ''),
    dataCompra: String(formData.get('dataCompra') ?? ''),
    mercado: String(formData.get('mercado') ?? ''),
    marca: String(formData.get('marca') ?? ''),
    qtdeEmbalagens: String(formData.get('qtdeEmbalagens') ?? ''),
    tamanhoEmbalagem: String(formData.get('tamanhoEmbalagem') ?? ''),
    precoPorEmbalagem: String(formData.get('precoPorEmbalagem') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const qtdeTotalBase = parsed.data.qtdeEmbalagens.times(parsed.data.tamanhoEmbalagem)
  if (qtdeTotalBase.isZero()) return { error: QTDE_INVALIDA }
  const precoTotal = parsed.data.qtdeEmbalagens.times(parsed.data.precoPorEmbalagem)
  const custoPorUnidadeBase = precoTotal.dividedBy(qtdeTotalBase)

  const antes = await prisma.ingredienteCompra.findUnique({ where: { id } })
  if (!antes) return { error: GENERIC_SERVER_ERROR }

  const marca = await canonicalize('marca', parsed.data.marca)
  const mercado = await canonicalize('mercado', parsed.data.mercado)

  try {
    await prisma.ingredienteCompra.update({
      where: { id },
      data: {
        ingredienteId: parsed.data.ingredienteId,
        dataCompra: new Date(`${parsed.data.dataCompra}T00:00:00Z`),
        mercado,
        marca,
        qtdeEmbalagens: parsed.data.qtdeEmbalagens.toFixed(3),
        tamanhoEmbalagem: parsed.data.tamanhoEmbalagem.toFixed(3),
        precoPorEmbalagem: parsed.data.precoPorEmbalagem.toFixed(4),
        qtdeTotalBase: qtdeTotalBase.toFixed(3),
        precoTotal: precoTotal.toFixed(4),
        custoPorUnidadeBase: custoPorUnidadeBase.toFixed(6),
      },
    })
  } catch (err) {
    if (err instanceof Error && /imutavel/.test(err.message)) return { error: COMPRA_IMUTAVEL }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'compra_corrigida',
    entityType: 'ingrediente_compra',
    entityId: id,
    metadata: { antes: { marca: antes.marca, mercado: antes.mercado }, depois: { marca, mercado } },
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/ingredientes')
  return { ok: true, message: 'Corrigido!' }
}

export async function excluirCompra(id: string): Promise<CompraActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const bloqueada = await assertCompraEditavel(id)
  if (bloqueada) return bloqueada

  try {
    await prisma.ingredienteCompra.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Error && /imutavel/.test(err.message)) return { error: COMPRA_IMUTAVEL }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'compra_excluida',
    entityType: 'ingrediente_compra',
    entityId: id,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/ingredientes')
  return { ok: true, message: 'Excluído.' }
}

export async function sugestoesMarca(prefix: string): Promise<string[]> {
  try {
    await requireAdmin()
  } catch {
    return []
  }
  try {
    const rows = await prisma.$queryRaw<{ marca: string }[]>`
      SELECT DISTINCT marca FROM ingrediente_compras
      WHERE marca ILIKE ${prefix + '%'} ORDER BY marca LIMIT 10`
    return rows.map((r) => r.marca)
  } catch {
    return []
  }
}

export async function sugestoesMercado(prefix: string): Promise<string[]> {
  try {
    await requireAdmin()
  } catch {
    return []
  }
  try {
    const rows = await prisma.$queryRaw<{ mercado: string }[]>`
      SELECT DISTINCT mercado FROM ingrediente_compras
      WHERE mercado ILIKE ${prefix + '%'} ORDER BY mercado LIMIT 10`
    return rows.map((r) => r.mercado)
  } catch {
    return []
  }
}
