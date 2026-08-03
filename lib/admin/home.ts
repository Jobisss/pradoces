import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'
import { margensCorrentesBatch } from '@/lib/custo/corrente'

export type Pendencia = { texto: string; href: string }

function hojeDate(): Date {
  return new Date(`${hojeSaoPaulo()}T00:00:00Z`)
}

/**
 * ADM-01 — heurísticas simples de propósito (sem tabela nova, sem fila de
 * background): tudo computado ON-READ a partir do que já existe.
 * "Ingrediente acabando" usa a heurística literal do requisito ("pouca
 * compra recente") porque o sistema não rastreia estoque restante de
 * ingrediente em lugar nenhum — só o histórico de compras.
 */
export async function listarPendencias(): Promise<Pendencia[]> {
  const pendencias: Pendencia[] = []

  const reservasPendentes = await prisma.reserva.count({ where: { status: 'PENDENTE' } })
  if (reservasPendentes > 0) {
    pendencias.push({
      texto: `${reservasPendentes} reserva${reservasPendentes > 1 ? 's' : ''} esperando confirmação`,
      href: '/admin/reservas',
    })
  }

  const hoje = hojeDate()
  const em2Dias = new Date(hoje)
  em2Dias.setUTCDate(em2Dias.getUTCDate() + 2)
  const lotesVencendo = await prisma.lote.findMany({
    where: { validade: { gte: hoje, lte: em2Dias }, qtdeDisponivel: { gt: 0 } },
    select: { produto: { select: { nome: true } } },
  })
  for (const l of lotesVencendo) {
    pendencias.push({ texto: `${l.produto.nome} — lote vencendo em até 2 dias`, href: '/admin/lotes' })
  }

  const HA_30_DIAS = new Date(hoje)
  HA_30_DIAS.setUTCDate(HA_30_DIAS.getUTCDate() - 30)
  const ingredientes = await prisma.ingrediente.findMany({
    where: { tipo: 'INGREDIENTE' },
    select: { id: true, nome: true, compras: { orderBy: { dataCompra: 'desc' }, take: 1, select: { dataCompra: true } } },
  })
  for (const i of ingredientes) {
    const ultima = i.compras[0]?.dataCompra
    if (!ultima || ultima < HA_30_DIAS) {
      pendencias.push({
        texto: `${i.nome} — sem compra registrada há mais de 30 dias`,
        href: `/admin/ingredientes/${i.id}`,
      })
    }
  }

  const margens = await margensCorrentesBatch()
  for (const m of margens.filter((x) => x.margem !== null && x.margem.lessThan(x.minima))) {
    pendencias.push({
      texto: `${m.nome} — margem caiu pra ${m.margem!.toFixed(0)}%`,
      href: `/admin/produtos/${m.produtoId}/editar`,
    })
  }

  return pendencias
}

export type ResumoDoDia = {
  faturamento: Decimal
  custoTotal: Decimal
  lucro: Decimal
  retiradasPendentes: number
}

/** ADM-04 — confirmadas HOJE (não "criadas hoje"): é o dia em que a venda de fato aconteceu. */
export async function resumoDoDia(): Promise<ResumoDoDia> {
  const hoje = hojeDate()
  const amanha = new Date(hoje)
  amanha.setUTCDate(amanha.getUTCDate() + 1)

  const reservasHoje = await prisma.reserva.findMany({
    where: { tipo: 'PADRAO', confirmadaEm: { gte: hoje, lt: amanha } },
    select: { itens: { select: { qtde: true, precoUnitarioCongelado: true, lote: { select: { custoPorUnidadeCongelado: true } } } } },
  })

  let faturamento = new Decimal(0)
  let custoTotal = new Decimal(0)
  for (const r of reservasHoje) {
    for (const item of r.itens) {
      faturamento = faturamento.plus(item.precoUnitarioCongelado.times(item.qtde))
      custoTotal = custoTotal.plus(item.lote.custoPorUnidadeCongelado.times(item.qtde))
    }
  }

  const retiradasPendentes = await prisma.reserva.count({
    where: { status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA'] } },
  })

  return { faturamento, custoTotal, lucro: faturamento.minus(custoTotal), retiradasPendentes }
}
