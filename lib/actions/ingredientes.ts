'use server'

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { IngredienteSchema } from '@/lib/validation/ingredientes'

const UuidSchema = z.string().uuid()

/**
 * Ingrediente CRUD, admin-only (ING-01/ING-06). Embalagens entram pelo MESMO
 * fluxo com tipo='EMBALAGEM' — nenhuma action separada.
 */

const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const NOME_DUPLICADO = 'Já existe um ingrediente com esse nome — abre ele pra ver o histórico.'

export type IngredienteActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  message?: string
  ok?: boolean
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function criarIngrediente(
  _prev: unknown,
  formData: FormData,
): Promise<IngredienteActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = IngredienteSchema.safeParse({
    nome: String(formData.get('nome') ?? ''),
    unidadeBase: String(formData.get('unidadeBase') ?? ''),
    tipo: String(formData.get('tipo') ?? 'INGREDIENTE'),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.ingrediente.create({ data: parsed.data })
  } catch (err) {
    if (isUniqueViolation(err)) return { error: NOME_DUPLICADO }
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/ingredientes')
  redirect('/admin/ingredientes')
}

export async function editarIngrediente(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<IngredienteActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (!UuidSchema.safeParse(id).success) return { error: GENERIC_SERVER_ERROR }

  const parsed = IngredienteSchema.safeParse({
    nome: String(formData.get('nome') ?? ''),
    unidadeBase: String(formData.get('unidadeBase') ?? ''),
    tipo: String(formData.get('tipo') ?? 'INGREDIENTE'),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const atual = await prisma.ingrediente.findUnique({ where: { id } })
  if (!atual) return { error: GENERIC_SERVER_ERROR }

  if (atual.unidadeBase !== parsed.data.unidadeBase) {
    const comprasCount = await prisma.ingredienteCompra.count({ where: { ingredienteId: id } })
    if (comprasCount > 0) {
      return {
        error: `Esse ingrediente já tem compras registradas em ${atual.unidadeBase} — a unidade não pode mais mudar.`,
      }
    }
  }

  try {
    await prisma.ingrediente.update({ where: { id }, data: parsed.data })
  } catch (err) {
    if (isUniqueViolation(err)) return { error: NOME_DUPLICADO }
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/ingredientes')
  redirect('/admin/ingredientes')
}
