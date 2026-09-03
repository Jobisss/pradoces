import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { pontosDeVenda, pontosDeResgate } from '@/lib/pontos/calculo'

const d = (v: string | number) => new Decimal(v)

/**
 * Ponto lastreado em LUCRO e preço de resgate ancorado no CUSTO (PT-01).
 * Funções puras — esse arquivo roda sem banco.
 */
describe('pontosDeVenda — crédito lastreado em lucro', () => {
  it('credita sobre o lucro, não sobre o faturamento', () => {
    // Vendeu R$ 6,00 num doce que custou R$ 3,00 → lucro R$ 3,00.
    expect(pontosDeVenda(d('3.00'), d(1))).toBe(3)
  })

  it('dois produtos do mesmo preço dão pontos diferentes conforme a margem', () => {
    // Ambos vendidos a R$ 18,00. O de margem boa credita muito mais.
    const margemBoa = d('18.00').minus('4.00')
    const margemRuim = d('18.00').minus('14.76')
    expect(pontosDeVenda(margemBoa, d(1))).toBe(14)
    expect(pontosDeVenda(margemRuim, d(1))).toBe(3)
  })

  it('venda no prejuízo credita zero, nunca ponto negativo', () => {
    expect(pontosDeVenda(d('-2.50'), d(1))).toBe(0)
    expect(pontosDeVenda(d(0), d(1))).toBe(0)
  })

  it('arredonda pra baixo — não inventa ponto que o lucro não pagou', () => {
    expect(pontosDeVenda(d('3.99'), d(1))).toBe(3)
    expect(pontosDeVenda(d('3.00'), d('1.5'))).toBe(4) // 4.5 → 4
  })
})

describe('pontosDeResgate — preço ancorado no custo', () => {
  it('reproduz o exemplo que originou a regra', () => {
    // Doce de custo R$ 3,00. Devolvendo ~14,3% do lucro, o cliente precisa
    // ter gerado R$ 21,00 de lucro pra levar um de graça.
    expect(pontosDeResgate(d('3.00'), d('14.2857'), d(1))).toBe(21)
  })

  it('devolução maior deixa o brinde mais barato', () => {
    expect(pontosDeResgate(d('3.00'), d(10), d(1))).toBe(30)
    expect(pontosDeResgate(d('3.00'), d(15), d(1))).toBe(20)
    expect(pontosDeResgate(d('3.00'), d(30), d(1))).toBe(10)
  })

  it('produto caro de fazer custa mais pontos que produto barato', () => {
    // É o ponto todo de ancorar no custo: o brinde caro exige mais lucro
    // acumulado, mesmo que os dois vendam pelo mesmo preço.
    expect(pontosDeResgate(d('14.76'), d(15), d(1))).toBe(99)
    expect(pontosDeResgate(d('1.42'), d(15), d(1))).toBe(10)
  })

  it('arredonda pra cima — nunca dá o doce mais barato por causa de centavo', () => {
    // 1,42 ÷ 0,15 = 9,466... → 10
    expect(pontosDeResgate(d('1.42'), d(15), d(1))).toBe(10)
  })

  it('acompanha a escala de pontosPorReal', () => {
    expect(pontosDeResgate(d('3.00'), d(15), d(10))).toBe(200)
  })

  it('nunca cobra menos de 1 ponto', () => {
    expect(pontosDeResgate(d('0.001'), d(100), d(1))).toBe(1)
  })

  it('devolução zero não vira divisão por zero', () => {
    expect(pontosDeResgate(d('3.00'), d(0), d(1))).toBe(0)
  })
})

describe('a conta fecha: custo do programa = lucro × devolução', () => {
  it('o cliente que junta o preço exato de um resgate devolveu a fatia esperada', () => {
    const custo = d('3.00')
    const devolucao = d(15)
    const preco = pontosDeResgate(custo, devolucao, d(1))

    // O cliente precisou gerar `preco` de lucro (1 ponto = R$1 de lucro).
    const lucroGerado = d(preco)
    // A casa devolveu `custo` em ingrediente.
    const fatiaDevolvida = custo.dividedBy(lucroGerado).times(100)

    // Bate com a devolução configurada (folga do arredondamento pra cima).
    expect(fatiaDevolvida.toNumber()).toBeGreaterThan(14)
    expect(fatiaDevolvida.toNumber()).toBeLessThanOrEqual(15)
  })
})
