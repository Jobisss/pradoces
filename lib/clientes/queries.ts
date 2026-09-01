import 'server-only'
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

  const saldos = await prisma.pontosTransacao.groupBy({
    by: ['clienteId'],
    where: { clienteId: { in: clientes.map((c) => c.id) } },
    _sum: { valor: true },
  })
  const saldoPorCliente = new Map(saldos.map((s) => [s.clienteId, s._sum.valor ?? 0]))

  return clientes.map((c) => ({ ...c, saldoPontos: saldoPorCliente.get(c.id) ?? 0 }))
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
