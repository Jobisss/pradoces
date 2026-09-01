import Decimal from 'decimal.js'

/**
 * Matemática do crédito de pontos (PT-01/05), num lugar só.
 *
 * Existem DOIS caminhos que creditam pontos por uma venda — confirmar uma
 * reserva feita pelo site (lib/actions/reservas-admin.ts) e registrar uma venda
 * direta no balcão (lib/actions/lotes.ts). Se as duas contas divergirem, o
 * mesmo produto passa a valer pontos diferentes dependendo de por onde foi
 * vendido, e não tem como o cliente entender. Por isso as duas chamam daqui.
 *
 * PT-04 (teto por reserva) foi removido a pedido da usuária — credita o valor
 * cheio, sem clamp.
 */
export function pontosDeVenda(valorTotal: Decimal, pontosPorReal: Decimal): number {
  return valorTotal.times(pontosPorReal).floor().toNumber()
}

/** PT-05 — crédito expira N meses depois da venda. */
export function expiracaoDoCredito(quando: Date, meses: number): Date {
  const expiraEm = new Date(quando)
  expiraEm.setMonth(expiraEm.getMonth() + meses)
  return expiraEm
}
