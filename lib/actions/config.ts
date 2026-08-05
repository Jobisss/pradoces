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
    pontosPorReal: String(formData.get('pontosPorReal') ?? ''),
    pontosCapPorReserva: String(formData.get('pontosCapPorReserva') ?? ''),
    pontosExpiracaoMeses: String(formData.get('pontosExpiracaoMeses') ?? ''),
    janelaCancelamentoHoras: String(formData.get('janelaCancelamentoHoras') ?? ''),
    taxaEntregaPadrao: String(formData.get('taxaEntregaPadrao') ?? ''),
    // Checkbox desmarcado não manda a chave no FormData (mesmo padrão do
    // consentimento LGPD do cadastro — ver 01-08 em STATE.md).
    entregaAtiva: formData.get('entregaAtiva') === 'on',
    pixAtivo: formData.get('pixAtivo') === 'on',
    pixTipoChave: String(formData.get('pixTipoChave') ?? '') || undefined,
    pixChave: String(formData.get('pixChave') ?? ''),
    pixNomeBeneficiario: String(formData.get('pixNomeBeneficiario') ?? ''),
    pixCidade: String(formData.get('pixCidade') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const data = {
    margemMinimaPadrao: parsed.data.margemMinimaPadrao.toFixed(2),
    pontosPorReal: parsed.data.pontosPorReal.toFixed(2),
    pontosCapPorReserva: parsed.data.pontosCapPorReserva,
    pontosExpiracaoMeses: parsed.data.pontosExpiracaoMeses,
    janelaCancelamentoHoras: parsed.data.janelaCancelamentoHoras,
    taxaEntregaPadrao: parsed.data.taxaEntregaPadrao.toFixed(2),
    entregaAtiva: parsed.data.entregaAtiva,
    pixAtivo: parsed.data.pixAtivo,
    // `?? null` (nunca undefined) — o mesmo objeto `data` serve pro create e
    // pro update do upsert; undefined faria o Prisma ignorar a chave no
    // update, deixando um valor antigo "preso" mesmo depois de a mãe apagar
    // o campo na tela.
    pixTipoChave: parsed.data.pixTipoChave ?? null,
    pixChave: parsed.data.pixChave ?? null,
    pixNomeBeneficiario: parsed.data.pixNomeBeneficiario ?? null,
    pixCidade: parsed.data.pixCidade ?? null,
  }

  try {
    await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/produtos')
  revalidatePath('/admin/ajustes')
  return { ok: true, message: 'Salvo!' }
}
