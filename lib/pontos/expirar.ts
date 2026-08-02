import 'server-only'
import { prisma } from '@/lib/db/client'

/**
 * PT-05 — expira créditos de pontos vencidos (expiraEm <= agora) escrevendo
 * um débito compensatório (ledger imutável, nunca edita o crédito original).
 * Créditos cuja reserva já foi CANCELADA são pulados — o cancelamento já
 * escreveu o débito (motivo CANCELAMENTO) na hora, expirar de novo seria
 * debitar em dobro. `reservaId` correlaciona 1:1 com o crédito (uma reserva
 * gera no máximo 1 PontosTransacao de RESERVA_CONFIRMADA), então checar se
 * já existe um débito EXPIRACAO com o mesmo reservaId evita reprocessar.
 */
export async function expirarPontosVencidos(): Promise<{ expirados: number }> {
  const agora = new Date()

  const creditosVencidos = await prisma.pontosTransacao.findMany({
    where: { motivo: 'RESERVA_CONFIRMADA', expiraEm: { lte: agora } },
    select: { clienteId: true, valor: true, reservaId: true, reserva: { select: { status: true } } },
  })

  let expirados = 0
  for (const credito of creditosVencidos) {
    if (credito.reserva?.status === 'CANCELADA') continue

    const jaExpirado = await prisma.pontosTransacao.findFirst({
      where: { motivo: 'EXPIRACAO', reservaId: credito.reservaId },
      select: { id: true },
    })
    if (jaExpirado) continue

    await prisma.pontosTransacao.create({
      data: { clienteId: credito.clienteId, valor: -credito.valor, motivo: 'EXPIRACAO', reservaId: credito.reservaId },
    })
    expirados++
  }

  return { expirados }
}
