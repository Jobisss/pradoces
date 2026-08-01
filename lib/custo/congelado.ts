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

export function computeLoteSnapshot(args: {
  linhas: Array<{
    compra: { id: string; marca: string; custoPorUnidadeBase: Decimal }
    qtdeUsada: Decimal
  }>
  custoGas: Decimal
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
  const custoTotalCongelado = somaUsos.plus(args.custoGas)
  const custoPorUnidadeCongelado = custoTotalCongelado.dividedBy(args.rendimentoReal)

  return {
    usos,
    custoTotalCongelado: custoTotalCongelado.toFixed(4),
    custoPorUnidadeCongelado: custoPorUnidadeCongelado.toFixed(6),
    custoGasCongelado: args.custoGas.toFixed(4),
  }
}
