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
  valorPorPonto?: string
  baseadoEmCatalogoReal?: boolean
  cashbackPercent?: string
  margemMinimaPadrao?: string
  arriscado?: boolean
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

  // Valor real de resgate por ponto = média de (preço de venda ÷ custoPontos)
  // dos itens ativos do catálogo — substitui o antigo placeholder "1 ponto ~
  // R$1" (só fazia sentido antes do catálogo de resgate existir, Phase 5).
  // Sem itens de catálogo cadastrados ainda, cai de volta pro placeholder.
  const [itensCatalogo, config] = await Promise.all([
    // D-13: preço vem da Variação prometida, não do Produto (que não tem
    // mais preço próprio pra UNITARIO).
    prisma.itemResgatavel.findMany({
      where: { ativo: true, variacaoId: { not: null } },
      select: { custoPontos: true, variacao: { select: { precoVenda: true } } },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])

  const baseadoEmCatalogoReal = itensCatalogo.length > 0
  const valorPorPonto = baseadoEmCatalogoReal
    ? itensCatalogo
        .reduce((soma, item) => soma.plus(new Decimal(item.variacao!.precoVenda).dividedBy(item.custoPontos)), new Decimal(0))
        .dividedBy(itensCatalogo.length)
    : new Decimal(1)

  const margemMinimaPadrao = config?.margemMinimaPadrao ?? new Decimal(30)
  const cashbackPercent = valorPorPonto.times(parsed.data.pontosPorReal).times(100)

  return {
    totalPontos: totalPontos.toNumber(),
    totalReservas: reservas.length,
    custoEstimado: totalPontos.times(valorPorPonto).toFixed(2),
    valorPorPonto: valorPorPonto.toFixed(4),
    baseadoEmCatalogoReal,
    cashbackPercent: cashbackPercent.toFixed(1),
    margemMinimaPadrao: margemMinimaPadrao.toFixed(2),
    arriscado: cashbackPercent.gte(margemMinimaPadrao),
  }
}
