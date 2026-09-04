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

export type MetaDoMes = {
  /** 0 = sem meta configurada; a home esconde o bloco. */
  meta: Decimal
  faturamento: Decimal
  /** Quanto do trabalho dela já foi pago pelas vendas do mês. */
  maoDeObraPaga: Decimal
  /** Já é líquido da mão de obra — ela entra no custo congelado do lote. */
  lucro: Decimal
  /** % da meta batida (pode passar de 100). null quando não há meta. */
  progresso: Decimal | null
  diasRestantes: number
  /** Quanto de lucro por dia falta pra fechar o mês na meta. */
  ritmoNecessario: Decimal
}

/**
 * ADM/FIN — meta de lucro do mês, já descontada a mão de obra.
 *
 * "Lucro" aqui é o que sobra DEPOIS de ela se pagar: a mão de obra entra no
 * custo congelado do lote (lib/custo/congelado.ts), então
 * `preço − custoPorUnidadeCongelado` já vem líquido. `maoDeObraPaga` é
 * extraída à parte só pra ela conseguir ver os dois números separados —
 * quanto do trabalho dela as vendas já cobriram, e quanto sobrou além disso.
 */
export async function metaDoMes(): Promise<MetaDoMes> {
  const hojeStr = hojeSaoPaulo()
  const inicioMes = new Date(`${hojeStr.slice(0, 7)}-01T00:00:00Z`)
  const amanha = new Date(`${hojeStr}T00:00:00Z`)
  amanha.setUTCDate(amanha.getUTCDate() + 1)

  const [reservas, baixas, config] = await Promise.all([
    prisma.reserva.findMany({
      where: { confirmadaEm: { gte: inicioMes, lt: amanha } },
      select: {
        tipo: true,
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: {
              select: {
                custoPorUnidadeCongelado: true,
                custoMaoDeObraCongelado: true,
                rendimentoReal: true,
              },
            },
          },
        },
      },
    }),
    prisma.loteBaixa.findMany({
      where: { criadoEm: { gte: inicioMes, lt: amanha } },
      select: { qtde: true, lote: { select: { custoPorUnidadeCongelado: true } } },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 }, select: { metaLucroMensal: true } }),
  ])

  let faturamento = new Decimal(0)
  let custo = new Decimal(0)
  let maoDeObraPaga = new Decimal(0)

  for (const r of reservas) {
    for (const item of r.itens) {
      custo = custo.plus(item.lote.custoPorUnidadeCongelado.times(item.qtde))
      if (r.tipo !== 'RESGATE') {
        faturamento = faturamento.plus(item.precoUnitarioCongelado.times(item.qtde))
      }
      // Mão de obra do lote é do LOTE inteiro — a fatia que saiu nessa venda
      // é proporcional ao que foi vendido dele.
      if (item.lote.rendimentoReal > 0) {
        maoDeObraPaga = maoDeObraPaga.plus(
          item.lote.custoMaoDeObraCongelado.dividedBy(item.lote.rendimentoReal).times(item.qtde),
        )
      }
    }
  }
  for (const b of baixas) {
    custo = custo.plus(b.lote.custoPorUnidadeCongelado.times(b.qtde))
  }

  const meta = new Decimal(config?.metaLucroMensal?.toString() ?? 0)
  const lucro = faturamento.minus(custo)

  // Dias restantes conta o de hoje: ainda dá pra vender hoje.
  const hoje = new Date(`${hojeStr}T00:00:00Z`)
  const ultimoDia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0))
  const diasRestantes = ultimoDia.getUTCDate() - hoje.getUTCDate() + 1
  const falta = Decimal.max(0, meta.minus(lucro))

  return {
    meta,
    faturamento,
    maoDeObraPaga,
    lucro,
    progresso: meta.isZero() ? null : lucro.dividedBy(meta).times(100),
    diasRestantes,
    ritmoNecessario: diasRestantes > 0 ? falta.dividedBy(diasRestantes) : falta,
  }
}

export type ResumoDoDia = {
  faturamento: Decimal
  /** Venda + resgate + baixa: tudo que o estoque consumiu hoje. */
  custoTotal: Decimal
  /** Custo do que saiu por pontos hoje — parte do custoTotal, destacado. */
  custoResgates: Decimal
  unidadesResgatadas: number
  lucro: Decimal
  /** Margem do dia em %, ou null quando não houve venda (evita divisão por zero). */
  margem: Decimal | null
  reservasDoDia: number
  retiradasPendentes: number
}

/**
 * ADM-04 — confirmadas HOJE (não "criadas hoje"): é o dia em que a venda de
 * fato aconteceu.
 *
 * Receita só de PADRAO (resgate é pago em pontos), mas o CUSTO conta os três
 * caminhos que tiram doce da prateleira: venda, resgate e baixa. Contar só o
 * custo das vendas fazia o doce trocado por pontos parecer de graça.
 */
export async function resumoDoDia(): Promise<ResumoDoDia> {
  const hoje = hojeDate()
  const amanha = new Date(hoje)
  amanha.setUTCDate(amanha.getUTCDate() + 1)

  const [reservasHoje, baixasHoje, retiradasPendentes] = await Promise.all([
    prisma.reserva.findMany({
      where: { confirmadaEm: { gte: hoje, lt: amanha } },
      select: {
        tipo: true,
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: { select: { custoPorUnidadeCongelado: true } },
          },
        },
      },
    }),
    prisma.loteBaixa.findMany({
      where: { criadoEm: { gte: hoje, lt: amanha } },
      select: { qtde: true, lote: { select: { custoPorUnidadeCongelado: true } } },
    }),
    prisma.reserva.count({ where: { status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA'] } } }),
  ])

  let faturamento = new Decimal(0)
  let custoTotal = new Decimal(0)
  let custoResgates = new Decimal(0)
  let unidadesResgatadas = 0
  let reservasDoDia = 0

  for (const r of reservasHoje) {
    const resgate = r.tipo === 'RESGATE'
    if (!resgate) reservasDoDia += 1
    for (const item of r.itens) {
      const custo = item.lote.custoPorUnidadeCongelado.times(item.qtde)
      custoTotal = custoTotal.plus(custo)
      if (resgate) {
        custoResgates = custoResgates.plus(custo)
        unidadesResgatadas += item.qtde
      } else {
        faturamento = faturamento.plus(item.precoUnitarioCongelado.times(item.qtde))
      }
    }
  }

  for (const b of baixasHoje) {
    custoTotal = custoTotal.plus(b.lote.custoPorUnidadeCongelado.times(b.qtde))
  }

  const lucro = faturamento.minus(custoTotal)

  return {
    faturamento,
    custoTotal,
    custoResgates,
    unidadesResgatadas,
    lucro,
    margem: faturamento.isZero() ? null : lucro.dividedBy(faturamento).times(100),
    reservasDoDia,
    retiradasPendentes,
  }
}
