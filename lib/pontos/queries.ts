import 'server-only'
import { prisma } from '@/lib/db/client'

/** PT-03 — saldo é SEMPRE derivado por SUM aqui, nunca uma coluna em User. */
export async function saldoPontos(clienteId: string): Promise<number> {
  const resultado = await prisma.pontosTransacao.aggregate({
    where: { clienteId },
    _sum: { valor: true },
  })
  return resultado._sum.valor ?? 0
}

const MOTIVO_LABEL: Record<string, string> = {
  RESERVA_CONFIRMADA: 'Reserva confirmada',
  CANCELAMENTO: 'Reserva cancelada',
  EXPIRACAO: 'Pontos expirados',
  AJUSTE_ADMIN: 'Ajuste manual',
  RESGATE: 'Troca por item',
  RESGATE_REJEITADO: 'Troca não aceita — pontos devolvidos',
  SORTEIO: 'Chance de sorteio',
}

/** PT-06 — extrato completo (data, valor, motivo). */
export async function extratoPontos(clienteId: string) {
  const transacoes = await prisma.pontosTransacao.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, valor: true, motivo: true, criadoEm: true, expiraEm: true },
  })
  return transacoes.map((t) => ({ ...t, motivoLabel: MOTIVO_LABEL[t.motivo] ?? t.motivo }))
}
