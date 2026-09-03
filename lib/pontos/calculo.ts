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

/**
 * Ponto é lastreado em LUCRO, não em faturamento.
 *
 * Antes era `valorTotal × taxa`. O problema: um bolo de pote de margem 18%
 * dava os mesmos pontos que um brigadeiro de margem 62% pelo mesmo preço, e a
 * casa financiava fidelidade com dinheiro que nunca ganhou. Agora entra o
 * lucro real da venda (preço congelado − custo congelado do lote).
 *
 * Venda no prejuízo credita ZERO — nunca ponto negativo, que viraria uma
 * dívida invisível no extrato do cliente.
 */
export function pontosDeVenda(lucro: Decimal, pontosPorReal: Decimal): number {
  if (lucro.lessThanOrEqualTo(0)) return 0
  return lucro.times(pontosPorReal).floor().toNumber()
}

/**
 * Preço em pontos de um item de resgate.
 *
 * Ancorado no CUSTO do doce, não no lucro dele: produzindo sob encomenda, o
 * doce dado de brinde não tomou o lugar de uma venda — o que sai do bolso é o
 * ingrediente. `devolucaoPercent` é o único botão: "de cada R$ 100 de lucro
 * que o cliente me deu, devolvo R$ X em custo de doce".
 *
 *   custo 3,00 · devolução 15% → 20 pontos (com pontosPorReal = 1)
 *
 * Efeito colateral desejado: produto de margem ruim fica caro de resgatar em
 * relação ao que rende, porque o cliente precisa de MUITAS compras dele pra
 * juntar o lucro necessário.
 */
export function pontosDeResgate(
  custoCorrente: Decimal,
  devolucaoPercent: Decimal,
  pontosPorReal: Decimal,
): number {
  if (devolucaoPercent.lessThanOrEqualTo(0)) return 0
  const lucroNecessario = custoCorrente.dividedBy(devolucaoPercent.dividedBy(100))

  // Quantiza em centavos ANTES de arredondar pra cima. Sem isso, uma
  // porcentagem que não fecha em decimal exato cobra um ponto inteiro a mais
  // por causa de resíduo: 3,00 ÷ 14,2857% = 21,000021, e o ceil cru vira 22.
  // Com a quantização vira 21,00 → 21, e o caso legítimo (9,47 → 10) continua
  // subindo. Arredondar pra cima é de propósito: melhor pedir um ponto a mais
  // que dar o doce barato demais por causa de centavo.
  const emPontos = lucroNecessario.times(pontosPorReal).toDecimalPlaces(2)
  return Decimal.max(1, emPontos.ceil()).toNumber()
}

/** PT-05 — crédito expira N meses depois da venda. */
export function expiracaoDoCredito(quando: Date, meses: number): Date {
  const expiraEm = new Date(quando)
  expiraEm.setMonth(expiraEm.getMonth() + meses)
  return expiraEm
}
