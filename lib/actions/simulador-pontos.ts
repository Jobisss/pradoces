'use server'

import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { SimuladorPontosSchema } from '@/lib/validation/config'

/** PT-09 — "se eu mudasse a taxa pra X, quanto teria custado nos últimos 30 dias?" */
export type SimuladorResultado = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  totalPontos?: number
  totalReservas?: number
  custoEstimado?: string
}

export async function simularTaxaPontos(_prev: unknown, formData: FormData): Promise<SimuladorResultado> {
  try {
    await requireAdmin()
  } catch {
    return { error: 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.' }
  }

  const parsed = SimuladorPontosSchema.safeParse({
    pontosPorReal: String(formData.get('pontosPorReal') ?? ''),
    capPorReserva: String(formData.get('capPorReserva') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const reservas = await prisma.reserva.findMany({
    where: { status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] }, confirmadaEm: { gte: desde } },
    select: { itens: { select: { qtde: true, precoUnitarioCongelado: true } } },
  })

  let totalPontos = new Decimal(0)
  for (const reserva of reservas) {
    const valor = reserva.itens.reduce((soma, i) => soma.plus(i.precoUnitarioCongelado.times(i.qtde)), new Decimal(0))
    const pontos = valor.times(parsed.data.pontosPorReal).floor()
    totalPontos = totalPontos.plus(Decimal.min(pontos, parsed.data.capPorReserva))
  }

  return {
    totalPontos: totalPontos.toNumber(),
    totalReservas: reservas.length,
    // Estimativa: assume 1 ponto ~ R$1 se algum dia virar resgate (ainda não existe catálogo, Phase 5).
    custoEstimado: totalPontos.toFixed(2),
  }
}
