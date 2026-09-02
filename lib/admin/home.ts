import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { hojeSaoPaulo } from '@/lib/lotes/queries'
import { margensCorrentesBatch } from '@/lib/custo/corrente'
import { dataCivilFmtBR, datetimeFmtBR } from '@/lib/format/date'

/**
 * Severidade da pendência. Não é enfeite: a lista plana antiga misturava
 * "3 reservas esperando" com "coco ralado sem compra há 41 dias" no mesmo
 * peso visual, e nenhuma das duas dizia o que fazer. Aqui cada item declara
 * QUANDO importa, QUANTO custa ignorar e QUAL é a próxima ação.
 */
export type Severidade = 'agora' | 'semana' | 'quando'

export type Pendencia = {
  id: string
  severidade: Severidade
  titulo: string
  contexto: string
  /** Rótulo do link — sempre um verbo específico, nunca "Ver". */
  acao: string
  href: string
  /** Marcador de tempo curto exibido à direita (ex.: "há 14h", "2 dias"). */
  quando?: string
}

const ORDEM: Record<Severidade, number> = { agora: 0, semana: 1, quando: 2 }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function hojeDate(): Date {
  return new Date(`${hojeSaoPaulo()}T00:00:00Z`)
}

/** "há 3h" / "há 2 dias" — a idade importa mais que o carimbo exato na fila. */
function idade(desde: Date): string {
  const horas = Math.floor((Date.now() - desde.getTime()) / 3_600_000)
  if (horas < 1) return 'agora há pouco'
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  return `há ${dias} dia${dias === 1 ? '' : 's'}`
}

function prazo(validade: Date, hoje: Date): string {
  const dias = Math.round((validade.getTime() - hoje.getTime()) / 86_400_000)
  if (dias <= 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/**
 * ADM-01 — heurísticas simples de propósito (sem tabela nova, sem fila de
 * background): tudo computado ON-READ a partir do que já existe.
 * "Ingrediente acabando" usa a heurística literal do requisito ("pouca
 * compra recente") porque o sistema não rastreia estoque restante de
 * ingrediente em lugar nenhum — só o histórico de compras.
 */
export async function listarPendencias(): Promise<Pendencia[]> {
  const hoje = hojeDate()
  const em2Dias = new Date(hoje)
  em2Dias.setUTCDate(em2Dias.getUTCDate() + 2)
  const ha30Dias = new Date(hoje)
  ha30Dias.setUTCDate(ha30Dias.getUTCDate() - 30)

  const [reservasPendentes, lotesVencendo, ingredientes, usoPorIngrediente, margens] =
    await Promise.all([
      prisma.reserva.findMany({
        where: { status: 'PENDENTE' },
        select: {
          criadoEm: true,
          taxaEntregaCongelada: true,
          itens: { select: { qtde: true, precoUnitarioCongelado: true } },
        },
        orderBy: { criadoEm: 'asc' },
      }),
      prisma.lote.findMany({
        where: { validade: { gte: hoje, lte: em2Dias }, qtdeDisponivel: { gt: 0 } },
        select: {
          id: true,
          validade: true,
          qtdeDisponivel: true,
          custoPorUnidadeCongelado: true,
          produto: { select: { nome: true } },
          variacao: { select: { nome: true } },
        },
        orderBy: { validade: 'asc' },
      }),
      prisma.ingrediente.findMany({
        where: { tipo: 'INGREDIENTE' },
        select: {
          id: true,
          nome: true,
          compras: { orderBy: { dataCompra: 'desc' }, take: 1, select: { dataCompra: true } },
        },
      }),
      // Quantas receitas dependem de cada ingrediente — sem isso "sem compra há
      // 41 dias" não diz se é urgente ou irrelevante.
      prisma.receitaIngrediente.groupBy({ by: ['ingredienteId'], _count: { _all: true } }),
      margensCorrentesBatch(),
    ])

  const pendencias: Pendencia[] = []

  if (reservasPendentes.length > 0) {
    const total = reservasPendentes.reduce((soma, r) => {
      const itens = r.itens.reduce(
        (s, i) => s.plus(i.precoUnitarioCongelado.times(i.qtde)),
        new Decimal(0)
      )
      return soma.plus(itens).plus(r.taxaEntregaCongelada?.toString() ?? 0)
    }, new Decimal(0))
    const maisAntiga = reservasPendentes[0].criadoEm
    const n = reservasPendentes.length

    pendencias.push({
      id: 'reservas-pendentes',
      severidade: 'agora',
      titulo: `${n} reserva${n > 1 ? 's' : ''} esperando confirmação`,
      contexto: `A mais antiga entrou em ${datetimeFmtBR.format(maisAntiga)} · ${currency.format(total.toNumber())} no total`,
      acao: 'Confirmar',
      href: '/admin/reservas',
      quando: idade(maisAntiga),
    })
  }

  for (const lote of lotesVencendo) {
    const nome = lote.variacao ? `${lote.produto.nome} — ${lote.variacao.nome}` : lote.produto.nome
    const parado = lote.custoPorUnidadeCongelado.times(lote.qtdeDisponivel)
    pendencias.push({
      id: `lote-${lote.id}`,
      severidade: 'agora',
      titulo: `${nome} — lote ${prazo(lote.validade, hoje)}`,
      contexto: `${lote.qtdeDisponivel} unidade${lote.qtdeDisponivel === 1 ? '' : 's'} ainda disponíve${lote.qtdeDisponivel === 1 ? 'l' : 'is'} · vence ${dataCivilFmtBR.format(lote.validade)} · ${currency.format(parado.toNumber())} de custo parado`,
      acao: 'Ver lote',
      href: '/admin/lotes',
      quando: prazo(lote.validade, hoje).replace('vence ', ''),
    })
  }

  for (const m of margens) {
    if (m.margem === null || !m.margem.lessThan(m.minima)) continue
    pendencias.push({
      id: `margem-${m.variacaoId ?? m.produtoId}`,
      severidade: 'semana',
      titulo: `${m.nome} — margem caiu pra ${m.margem.toFixed(0)}%`,
      contexto: `Mínima definida ${m.minima.toFixed(0)}% · vende a ${currency.format(m.precoVenda.toNumber())} e custa ${m.custo ? currency.format(m.custo.toNumber()) : '—'}`,
      acao: 'Rever preço',
      href: `/admin/produtos/${m.produtoId}/editar`,
    })
  }

  const usos = new Map(usoPorIngrediente.map((u) => [u.ingredienteId, u._count._all]))
  for (const i of ingredientes) {
    const ultima = i.compras[0]?.dataCompra
    if (ultima && ultima >= ha30Dias) continue
    const receitas = usos.get(i.id) ?? 0
    pendencias.push({
      id: `ingrediente-${i.id}`,
      severidade: 'quando',
      titulo: ultima
        ? `${i.nome} — sem compra ${idade(ultima)}`
        : `${i.nome} — nenhuma compra registrada`,
      contexto:
        receitas > 0
          ? `Usado em ${receitas} receita${receitas === 1 ? '' : 's'} · o custo congelado pode estar velho`
          : 'Ainda não entra em nenhuma receita',
      acao: 'Ver ingrediente',
      href: `/admin/ingredientes/${i.id}`,
      quando: ultima ? idade(ultima).replace('há ', '') : 'nunca',
    })
  }

  return pendencias.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade])
}

export type ResumoDoDia = {
  faturamento: Decimal
  custoTotal: Decimal
  lucro: Decimal
  /** Margem do dia em %, ou null quando não houve venda (evita divisão por zero). */
  margem: Decimal | null
  reservasDoDia: number
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

  const lucro = faturamento.minus(custoTotal)

  return {
    faturamento,
    custoTotal,
    lucro,
    margem: faturamento.isZero() ? null : lucro.dividedBy(faturamento).times(100),
    reservasDoDia: reservasHoje.length,
    retiradasPendentes,
  }
}
