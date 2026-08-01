import 'server-only'
import { prisma } from '@/lib/db/client'

/**
 * "Hoje" civil em America/Sao_Paulo, como 'yyyy-mm-dd' (Pitfall 10 — `validade`
 * é `@db.Date`; comparar com `new Date()` cru compara em UTC e erra a data
 * civil perto da virada do dia, já que São Paulo está sempre atrás de UTC).
 */
export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export type FiltroLote = 'vigentes' | 'vencidos' | 'esgotados'

/**
 * Lotes por filtro (LOTE-07), com produto pré-carregado (anti N+1). "Vigente"
 * inclui o lote que vence HOJE (ainda vende até o fim do dia).
 */
export async function listarLotes(filtro: FiltroLote) {
  const hoje = hojeSaoPaulo()

  if (filtro === 'vencidos') {
    return prisma.lote.findMany({
      where: { validade: { lt: new Date(`${hoje}T00:00:00Z`) } },
      include: { produto: { select: { nome: true } } },
      orderBy: { validade: 'desc' },
    })
  }

  if (filtro === 'esgotados') {
    return prisma.lote.findMany({
      where: { qtdeDisponivel: 0, validade: { gte: new Date(`${hoje}T00:00:00Z`) } },
      include: { produto: { select: { nome: true } } },
      orderBy: { validade: 'asc' },
    })
  }

  return prisma.lote.findMany({
    where: { validade: { gte: new Date(`${hoje}T00:00:00Z`) }, qtdeDisponivel: { gt: 0 } },
    include: { produto: { select: { nome: true } } },
    orderBy: { validade: 'asc' },
  })
}
