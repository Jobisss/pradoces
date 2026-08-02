import 'server-only'
import { prisma } from '@/lib/db/client'

/** SORT-07 — sorteios abertos, com quantas chances o próprio cliente já tem. */
export async function listarSorteiosAbertos(clienteId: string) {
  const sorteios = await prisma.sorteio.findMany({
    where: { status: 'ABERTO', prazo: { gt: new Date() } },
    orderBy: { prazo: 'asc' },
  })

  const minhasChances = await prisma.sorteioChance.groupBy({
    by: ['sorteioId'],
    where: { clienteId, sorteioId: { in: sorteios.map((s) => s.id) } },
    _count: { _all: true },
  })
  const chancesPorSorteio = new Map(minhasChances.map((c) => [c.sorteioId, c._count._all]))

  return sorteios.map((s) => ({ ...s, minhasChances: chancesPorSorteio.get(s.id) ?? 0 }))
}

/** SORT-07 — histórico de sorteios encerrados, vencedor visível. */
export async function listarSorteiosEncerrados() {
  return prisma.sorteio.findMany({
    where: { status: 'ENCERRADO' },
    include: { vencedor: { select: { name: true } } },
    orderBy: { encerradoEm: 'desc' },
    take: 20,
  })
}
