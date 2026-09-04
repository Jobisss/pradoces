import 'server-only'
import Decimal from 'decimal.js'

/**
 * TODA aritmética de custo do projeto mora aqui. Nada fora de lib/custo
 * soma/multiplica dinheiro.
 *
 * Função PURA, sem acesso a banco — a transação do plano 02-07 (produzir
 * lote) usa o retorno num nested create. `qtdeUsada` já vem escalada pelo
 * multiplicador (D-07); esta função só congela o custo a partir do que
 * recebe.
 */

/**
 * Custo do trabalho de uma fornada.
 *
 * Modelado como TEMPO × valor/hora, não como valor fixo por receita: assim
 * aumentar o próprio salário é mexer em UM número global (Configuracao), e
 * não reabrir receita por receita. Escala pelo multiplicador junto com os
 * ingredientes — fazer 2× a receita leva ~2× o tempo.
 *
 * Receita sem `minutosPreparo` (nunca medido) custa ZERO de mão de obra,
 * mesmo tratamento do `custoGas` ausente. É o que mantém a conta funcionando
 * antes de ela medir o tempo de cada receita.
 */
export function custoMaoDeObra(
  minutosPreparo: number | null | undefined,
  multiplicador: Decimal,
  valorHora: Decimal,
): Decimal {
  if (!minutosPreparo || minutosPreparo <= 0) return new Decimal(0)
  if (valorHora.lessThanOrEqualTo(0)) return new Decimal(0)
  return new Decimal(minutosPreparo).times(multiplicador).dividedBy(60).times(valorHora)
}

export function computeLoteSnapshot(args: {
  linhas: Array<{
    compra: { id: string; marca: string; custoPorUnidadeBase: Decimal }
    qtdeUsada: Decimal
  }>
  custoGas: Decimal
  /** Já escalado pelo multiplicador — ver custoMaoDeObra. */
  custoMaoDeObra?: Decimal
  rendimentoReal: number
}): {
  usos: Array<{
    ingredienteCompraId: string
    qtdeUsada: string
    marcaSnapshot: string
    custoUnitarioCongelado: string
    custoCongelado: string
  }>
  custoTotalCongelado: string
  custoPorUnidadeCongelado: string
  custoGasCongelado: string
  custoMaoDeObraCongelado: string
} {
  const usos = args.linhas.map((linha) => {
    const custoCongelado = linha.qtdeUsada.times(linha.compra.custoPorUnidadeBase)
    return {
      ingredienteCompraId: linha.compra.id,
      qtdeUsada: linha.qtdeUsada.toFixed(3),
      marcaSnapshot: linha.compra.marca,
      custoUnitarioCongelado: linha.compra.custoPorUnidadeBase.toFixed(6),
      custoCongelado: custoCongelado.toFixed(4),
    }
  })

  const somaUsos = args.linhas.reduce(
    (acc, linha) => acc.plus(linha.qtdeUsada.times(linha.compra.custoPorUnidadeBase)),
    new Decimal(0),
  )
  const maoDeObra = args.custoMaoDeObra ?? new Decimal(0)
  // Mão de obra entra no custo total igual gás e ingrediente. É isso que faz
  // o "lucro" parar de esconder o pagamento do trabalho dela.
  const custoTotalCongelado = somaUsos.plus(args.custoGas).plus(maoDeObra)
  const custoPorUnidadeCongelado = custoTotalCongelado.dividedBy(args.rendimentoReal)

  return {
    usos,
    custoTotalCongelado: custoTotalCongelado.toFixed(4),
    custoPorUnidadeCongelado: custoPorUnidadeCongelado.toFixed(6),
    custoGasCongelado: args.custoGas.toFixed(4),
    custoMaoDeObraCongelado: maoDeObra.toFixed(4),
  }
}
