'use server'

import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { SimuladorPontosSchema } from '@/lib/validation/config'

/**
 * PT-09 — "se eu mudasse a devolução pra X%, quanto o programa teria custado
 * nos últimos 30 dias?"
 *
 * Na regra nova a conta fecha sozinha e é essa a beleza do botão único:
 *
 *   pontos creditados      = lucro × pontosPorReal
 *   preço de um resgate    = custo ÷ (devolução/100) × pontosPorReal
 *   ⇒ custo do programa    = lucro × devolução/100
 *
 * Ou seja: a devolução É, literalmente, a fatia do lucro que volta como
 * ingrediente de brinde. Não precisa mais estimar "valor por ponto" tirando
 * média do catálogo — aquilo era um remendo de quando o preço em pontos era
 * digitado à mão e não tinha relação nenhuma com o custo.
 */
export type SimuladorResultado = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  /** Lucro real do período (preço congelado − custo congelado). */
  lucroPeriodo?: string
  faturamentoPeriodo?: string
  totalPontos?: number
  totalReservas?: number
  /** Quanto de ingrediente sairia de graça com essa devolução. */
  custoEstimado?: string
  devolucaoPercent?: string
  margemMinimaPadrao?: string
  /** Devolver mais do que a margem mínima é vender no vermelho pra fidelizar. */
  arriscado?: boolean
}

export async function simularTaxaPontos(_prev: unknown, formData: FormData): Promise<SimuladorResultado> {
  try {
    await requireAdmin()
  } catch {
    return { error: 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.' }
  }

  const parsed = SimuladorPontosSchema.safeParse({
    pontosDevolucaoPercent: String(formData.get('pontosDevolucaoPercent') ?? ''),
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [reservas, config] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        tipo: 'PADRAO',
        status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] },
        confirmadaEm: { gte: desde },
      },
      select: {
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: { select: { custoPorUnidadeCongelado: true } },
          },
        },
      },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])

  const pontosPorReal = config?.pontosPorReal ?? new Decimal(1)

  let faturamento = new Decimal(0)
  let lucro = new Decimal(0)
  for (const reserva of reservas) {
    for (const item of reserva.itens) {
      faturamento = faturamento.plus(item.precoUnitarioCongelado.times(item.qtde))
      lucro = lucro.plus(
        item.precoUnitarioCongelado.minus(item.lote.custoPorUnidadeCongelado).times(item.qtde),
      )
    }
  }
  // Venda no prejuízo não credita ponto (lib/pontos/calculo.ts) — o total
  // simulado tem que respeitar a mesma regra pra não prometer a mais.
  const lucroPositivo = Decimal.max(0, lucro)

  const devolucao = parsed.data.pontosDevolucaoPercent
  const margemMinimaPadrao = config?.margemMinimaPadrao ?? new Decimal(30)

  return {
    lucroPeriodo: lucro.toFixed(2),
    faturamentoPeriodo: faturamento.toFixed(2),
    totalPontos: lucroPositivo.times(pontosPorReal).floor().toNumber(),
    totalReservas: reservas.length,
    custoEstimado: lucroPositivo.times(devolucao).dividedBy(100).toFixed(2),
    devolucaoPercent: devolucao.toFixed(2),
    margemMinimaPadrao: margemMinimaPadrao.toFixed(2),
    arriscado: devolucao.gte(margemMinimaPadrao),
  }
}
