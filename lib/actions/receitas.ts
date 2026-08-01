'use server'

import type { z } from 'zod'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { ReceitaSchema } from '@/lib/validation/receitas'

/**
 * Receita (REC-01..05), admin-only. `itens` é replace-all em edição — itens
 * de receita não carregam histórico, o custo congelado vive só no lote
 * (lib/custo/congelado.ts), então trocar as linhas aqui não afeta lotes já
 * produzidos.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

export type ReceitaActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
}

/**
 * Zod's `.flatten()` colapsa erros de array (itens.N.campo) tudo debaixo da
 * mesma chave "itens", sem dizer QUAL linha — quem só olha o toast genérico
 * "Confere os campos abaixo." não tem como saber se esqueceu de escolher o
 * ingrediente da linha 2 ou digitou a quantidade errado na linha 1. Isso
 * monta uma mensagem que aponta a linha exata a partir de `error.issues`
 * (que preserva o path completo, ao contrário do flatten).
 */
function mensagemErroItens(issues: z.core.$ZodIssue[]): string | null {
  for (const issue of issues) {
    if (issue.path[0] !== 'itens') continue
    const indice = issue.path[1]
    if (typeof indice !== 'number') continue
    const linha = indice + 1
    const campo = issue.path[2]
    if (campo === 'ingredienteId') return `Confere a linha ${linha} dos ingredientes: escolhe um ingrediente da lista.`
    if (campo === 'qtde') {
      return `Confere a linha ${linha} dos ingredientes: a quantidade não parece certa. Usa vírgula pros decimais, tipo 395 ou 0,5.`
    }
  }
  return null
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const ua = h.get('user-agent') ?? undefined
  return { ip, ua }
}

export async function criarReceita(input: unknown): Promise<ReceitaActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ReceitaSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: mensagemErroItens(parsed.error.issues) ?? 'Confere os campos abaixo.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  let receita: { id: string }
  try {
    receita = await prisma.receita.create({
      data: {
        nome: parsed.data.nome,
        rendimentoPadrao: parsed.data.rendimentoPadrao,
        custoGas: parsed.data.custoGas ? parsed.data.custoGas.toFixed(4) : null,
        validadeDias: parsed.data.validadeDias ?? null,
        itens: {
          create: parsed.data.itens.map((item) => ({
            ingredienteId: item.ingredienteId,
            qtde: item.qtde.toFixed(3),
          })),
        },
      },
      select: { id: true },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/receitas')
  return { ok: true, id: receita.id }
}

export async function editarReceita(id: string, input: unknown): Promise<ReceitaActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ReceitaSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: mensagemErroItens(parsed.error.issues) ?? 'Confere os campos abaixo.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    await prisma.$transaction([
      prisma.receitaIngrediente.deleteMany({ where: { receitaId: id } }),
      prisma.receita.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          rendimentoPadrao: parsed.data.rendimentoPadrao,
          custoGas: parsed.data.custoGas ? parsed.data.custoGas.toFixed(4) : null,
          validadeDias: parsed.data.validadeDias ?? null,
        },
      }),
      prisma.receitaIngrediente.createMany({
        data: parsed.data.itens.map((item) => ({
          receitaId: id,
          ingredienteId: item.ingredienteId,
          qtde: item.qtde.toFixed(3),
        })),
      }),
    ])
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'receita_alterada',
    entityType: 'receita',
    entityId: id,
    rawIp: ip,
    rawUa: ua,
  })

  revalidatePath('/admin/receitas')
  return { ok: true, id }
}
