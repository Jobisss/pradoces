import type { ReservaStatus } from '@prisma/client'

/** Rótulo em português de cada status — compartilhado entre a fila de reservas e o relatório do cliente. */
export const STATUS_LABEL: Record<ReservaStatus, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADA: 'Confirmada',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
  RETIRADA: 'Retirada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'Não retirada',
}
