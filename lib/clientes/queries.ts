import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'

/** Admin (/admin/clientes) — busca por nome/email, saldo de pontos SUM'ado sem N+1 (mesmo padrão de listarReservasAdmin). */
export async function listarClientesAdmin(busca?: string) {
  const termo = busca?.trim()
  const clientes = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: 'customer',
      ...(termo
        ? { OR: [{ name: { contains: termo, mode: 'insensitive' } }, { email: { contains: termo, mode: 'insensitive' } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      telefone: true,
      isVip: true,
      banned: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })

  const ids = clientes.map((c) => c.id)

  const [saldos, compras] = await Promise.all([
    prisma.pontosTransacao.groupBy({
      by: ['clienteId'],
      where: { clienteId: { in: ids } },
      _sum: { valor: true },
    }),
    // Mesmo motivo de listarReservasAdmin: valor total é soma de qtde ×
    // precoCongelado do ITEM, não uma coluna de Reserva — groupBy não alcança,
    // e o volume ainda é pequeno o bastante pra reduzir em JS.
    prisma.reserva.findMany({
      where: {
        clienteId: { in: ids },
        tipo: 'PADRAO',
        status: { in: ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] },
      },
      select: {
        clienteId: true,
        criadoEm: true,
        itens: { select: { qtde: true, precoUnitarioCongelado: true } },
      },
    }),
  ])

  const saldoPorCliente = new Map(saldos.map((s) => [s.clienteId, s._sum.valor ?? 0]))

  type Historico = { totalReservas: number; valorTotal: number; ultimaCompra: Date | null }
  const historico = new Map<string, Historico>()
  for (const r of compras) {
    const id = r.clienteId!
    const atual = historico.get(id) ?? { totalReservas: 0, valorTotal: 0, ultimaCompra: null }
    atual.totalReservas += 1
    atual.valorTotal += r.itens.reduce((s, i) => s + i.qtde * Number(i.precoUnitarioCongelado), 0)
    if (!atual.ultimaCompra || r.criadoEm > atual.ultimaCompra) atual.ultimaCompra = r.criadoEm
    historico.set(id, atual)
  }

  return clientes.map((c) => ({
    ...c,
    saldoPontos: saldoPorCliente.get(c.id) ?? 0,
    ...(historico.get(c.id) ?? { totalReservas: 0, valorTotal: 0, ultimaCompra: null }),
  }))
}

/** Detalhe do cliente pro painel de gestão — inclui só os ajustes AJUSTE_ADMIN (histórico do que a mãe já mexeu manualmente). */
export async function buscarClienteAdmin(id: string) {
  const cliente = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      telefone: true,
      isVip: true,
      banned: true,
      banReason: true,
      createdAt: true,
    },
  })
  if (!cliente) return null

  const [saldoTotal, ajustesAdmin] = await Promise.all([
    prisma.pontosTransacao.aggregate({ where: { clienteId: id }, _sum: { valor: true } }),
    prisma.pontosTransacao.findMany({
      where: { clienteId: id, motivo: 'AJUSTE_ADMIN' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, valor: true, criadoEm: true },
    }),
  ])

  return {
    ...cliente,
    saldoPontos: saldoTotal._sum.valor ?? 0,
    saldoBonusAdmin: ajustesAdmin.reduce((soma, a) => soma + a.valor, 0),
    ajustesAdmin,
  }
}

/**
 * Relatório completo de UM cliente (/admin/clientes/[id]).
 *
 * Critério de "faturado" é o MESMO de lib/admin/relatorios.ts (tipo PADRAO,
 * status CONFIRMADA/AGUARDANDO_RETIRADA/RETIRADA, datado por confirmadaEm) —
 * de propósito, pra o total daqui bater com o relatório geral. Resgate não é
 * receita em R$: entra só no bloco de pontos.
 *
 * Taxa de entrega conta no "quanto esse cliente gastou" (foi dinheiro que
 * entrou), mas fica FORA do lucro por produto — custo de entrega não está
 * modelado em lugar nenhum, então somar a taxa no lucro inflaria a margem.
 * Por isso os dois números aparecem separados.
 *
 * Uma query de reservas (com itens+lote pro custo congelado) + uma de pontos:
 * agregação em JS mesmo, volume de clientela de bairro (mesma decisão de
 * listarReservasAdmin).
 */
export type RelatorioCliente = Awaited<ReturnType<typeof relatorioCliente>>

const STATUS_FATURADO = ['CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA'] as const

export async function relatorioCliente(clienteId: string, email: string, desde?: Date, ate?: Date) {
  const [reservas, pontos, convidadasNaoVinculadas] = await Promise.all([
    prisma.reserva.findMany({
      where: { clienteId },
      select: {
        id: true,
        token: true,
        tipo: true,
        status: true,
        pago: true,
        deliveryMode: true,
        taxaEntregaCongelada: true,
        valorResgateCongelado: true,
        janelaRetirada: true,
        criadoEm: true,
        confirmadaEm: true,
        itens: {
          select: {
            qtde: true,
            precoUnitarioCongelado: true,
            lote: {
              select: {
                custoPorUnidadeCongelado: true,
                produtoId: true,
                variacaoId: true,
                produto: { select: { nome: true } },
                variacao: { select: { nome: true } },
              },
            },
          },
        },
        itemResgatavel: {
          select: { custoPontos: true, nomeCustom: true, produto: { select: { nome: true } }, variacao: { select: { nome: true } } },
        },
      },
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.pontosTransacao.findMany({
      where: { clienteId },
      select: { valor: true, motivo: true, criadoEm: true },
    }),
    // Reserva feita como convidado com o mesmo email e que nunca foi vinculada
    // (a vinculação só roda na verificação do email — ver lib/auth/server.ts).
    // Não entra em nenhum número abaixo; é só um aviso de "tem histórico solto".
    prisma.reserva.count({ where: { clienteId: null, emailConvidado: email } }),
  ])

  // Período (opcional) filtra em JS pra não precisar de 2 queries: faturamento
  // é datado por confirmadaEm (igual relatorios.ts), o resto por criadoEm.
  const dentroDoPeriodo = (data: Date | null) => {
    if (!data) return false
    if (desde && data < desde) return false
    if (ate && data >= ate) return false
    return true
  }
  const noPeriodo = desde || ate ? reservas.filter((r) => dentroDoPeriodo(r.criadoEm)) : reservas

  const faturadas = reservas.filter(
    (r) =>
      r.tipo === 'PADRAO' &&
      (STATUS_FATURADO as readonly string[]).includes(r.status) &&
      (desde || ate ? dentroDoPeriodo(r.confirmadaEm) : true),
  )

  const porVariacao = new Map<string, { nome: string; qtde: number; receita: Decimal; custo: Decimal }>()
  let receitaProdutos = new Decimal(0)
  let custoProdutos = new Decimal(0)
  let taxasEntrega = new Decimal(0)

  for (const r of faturadas) {
    if (r.taxaEntregaCongelada) taxasEntrega = taxasEntrega.plus(r.taxaEntregaCongelada)
    for (const item of r.itens) {
      const receita = item.precoUnitarioCongelado.times(item.qtde)
      const custo = item.lote.custoPorUnidadeCongelado.times(item.qtde)
      receitaProdutos = receitaProdutos.plus(receita)
      custoProdutos = custoProdutos.plus(custo)

      const chave = item.lote.variacaoId ?? item.lote.produtoId
      const nome = item.lote.variacao
        ? `${item.lote.produto.nome} — ${item.lote.variacao.nome}`
        : item.lote.produto.nome
      const atual = porVariacao.get(chave) ?? { nome, qtde: 0, receita: new Decimal(0), custo: new Decimal(0) }
      atual.qtde += item.qtde
      atual.receita = atual.receita.plus(receita)
      atual.custo = atual.custo.plus(custo)
      porVariacao.set(chave, atual)
    }
  }

  const totalGasto = receitaProdutos.plus(taxasEntrega)
  const contagemPorStatus = noPeriodo.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const pontosPorMotivo = pontos.reduce<Record<string, number>>((acc, p) => {
    acc[p.motivo] = (acc[p.motivo] ?? 0) + p.valor
    return acc
  }, {})
  const resgates = reservas.filter((r) => r.tipo === 'RESGATE')
  const valorResgatado = resgates.reduce(
    (soma, r) => (r.valorResgateCongelado ? soma.plus(r.valorResgateCongelado) : soma),
    new Decimal(0),
  )

  return {
    faturado: {
      nReservas: faturadas.length,
      receitaProdutos,
      taxasEntrega,
      totalGasto,
      custo: custoProdutos,
      // Lucro é só produto (receita−custo congelado): a taxa de entrega não
      // entra porque o custo de entregar não é rastreado em lugar nenhum.
      lucro: receitaProdutos.minus(custoProdutos),
      ticketMedio: faturadas.length === 0 ? new Decimal(0) : totalGasto.dividedBy(faturadas.length),
    },
    contagemPorStatus,
    noShows: contagemPorStatus.NO_SHOW ?? 0,
    canceladas: contagemPorStatus.CANCELADA ?? 0,
    // reservas já vem ordenado por criadoEm desc.
    ultimaReserva: reservas[0]?.criadoEm ?? null,
    primeiraReserva: reservas.at(-1)?.criadoEm ?? null,
    favoritos: [...porVariacao.values()].sort((a, b) => b.qtde - a.qtde).slice(0, 5),
    timeline: noPeriodo,
    pontos: {
      ganhos: (pontosPorMotivo.RESERVA_CONFIRMADA ?? 0) + (pontosPorMotivo.SORTEIO ?? 0),
      gastos: pontosPorMotivo.RESGATE ?? 0,
      ajustes: pontosPorMotivo.AJUSTE_ADMIN ?? 0,
      estornos: (pontosPorMotivo.CANCELAMENTO ?? 0) + (pontosPorMotivo.RESGATE_REJEITADO ?? 0),
      expirados: pontosPorMotivo.EXPIRACAO ?? 0,
      nResgates: resgates.length,
      // "Quanto a mãe deixou de faturar trocando produto por pontos" — só
      // resgates que têm valorResgateCongelado (NULL nos antigos, ver schema).
      valorResgatado,
    },
    // Confirmada/retirada e ainda marcada como não paga (o `pago` é checklist
    // manual — ver schema). Cancelada/no-show não entra: não há o que cobrar.
    // Resgate fica de fora: é pago em pontos, `pago` nunca é marcado nele.
    pendencias: reservas.filter(
      (r) => !r.pago && r.tipo === 'PADRAO' && (STATUS_FATURADO as readonly string[]).includes(r.status),
    ),
    convidadasNaoVinculadas,
  }
}

/**
 * Só o necessário pro seletor de cliente da venda no balcão
 * (components/admin/lote-venda-acao.tsx) — sem saldo de pontos, que ali não é
 * usado e custaria um groupBy por render da lista de lotes.
 *
 * Cliente bloqueado sai da lista: se ela bloqueou, não é pra sair registrando
 * venda nova no nome dele sem querer.
 */
export async function listarClientesParaSelecao() {
  return prisma.user.findMany({
    where: { deletedAt: null, role: 'customer', banned: false },
    select: { id: true, name: true, email: true, isVip: true },
    orderBy: { name: 'asc' },
  })
}
