import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { precoSugerido, custoMaoDeObra } from '@/lib/custo/congelado'
import { taxaResolvida } from '@/lib/custo/corrente'

const d = (v: string | number) => new Decimal(v)

/** Funções puras — esse arquivo roda sem banco. */
describe('taxaResolvida — override da receita vence o padrão global', () => {
  it('usa o valor da receita quando preenchido', () => {
    expect(taxaResolvida(d(30), d(20)).toNumber()).toBe(30)
  })

  it('cai no padrão global quando a receita não tem o próprio', () => {
    expect(taxaResolvida(null, d(20)).toNumber()).toBe(20)
    expect(taxaResolvida(undefined, d(20)).toNumber()).toBe(20)
  })

  it('zero na receita é um valor válido, não "vazio"', () => {
    // Importante: 0 significa "essa receita não persegue lucro/hora", e não
    // pode cair no global silenciosamente.
    expect(taxaResolvida(d(0), d(20)).toNumber()).toBe(0)
  })
})

describe('precoSugerido', () => {
  it('soma ao custo o lucro/hora proporcional ao tempo da unidade', () => {
    // 5 min por unidade, R$ 20/h de lucro alvo = R$ 1,67 por unidade.
    const sugerido = precoSugerido(d('2.17'), d(5), d(20))
    expect(sugerido.toFixed(2)).toBe('3.84')
  })

  it('produto lento fica mais caro que produto que sai em série', () => {
    // Mesmo custo, mesma taxa: só o tempo difere. É a distinção que a margem
    // percentual nunca captura.
    const rapido = precoSugerido(d(2), d(3), d(20))
    const lento = precoSugerido(d(2), d(12), d(20))
    expect(rapido.toFixed(2)).toBe('3.00')
    expect(lento.toFixed(2)).toBe('6.00')
  })

  it('sem lucro/hora alvo devolve o próprio custo — sugestão desligada', () => {
    expect(precoSugerido(d('2.17'), d(5), d(0)).toFixed(2)).toBe('2.17')
  })

  it('sem tempo medido devolve o próprio custo', () => {
    expect(precoSugerido(d('2.17'), d(0), d(20)).toFixed(2)).toBe('2.17')
  })

  it('não depende de atraso do mês — mesma entrada, mesma saída sempre', () => {
    // O ponto da escolha de projeto: o número só se mexe quando ingrediente,
    // tempo ou taxa mudam. Nada de preço subindo porque o mês está ruim.
    const a = precoSugerido(d('2.17'), d(5), d(20))
    const b = precoSugerido(d('2.17'), d(5), d(20))
    expect(a.equals(b)).toBe(true)
  })
})

describe('a cadeia inteira: salário no custo, lucro no preço', () => {
  it('separa o que ela ganha pelo trabalho do que o negócio ganha', () => {
    // Brigadeiro: 150 min rende 30 un = 5 min/un.
    // Ingrediente R$ 0,50/un. Salário R$ 20/h. Lucro alvo R$ 20/h.
    const minutosPorUnidade = d(150).dividedBy(30)
    const salarioPorUnidade = custoMaoDeObra(150, d(1), d(20)).dividedBy(30)
    const custoPorUnidade = d('0.50').plus(salarioPorUnidade)

    expect(salarioPorUnidade.toFixed(2)).toBe('1.67')
    expect(custoPorUnidade.toFixed(2)).toBe('2.17')

    const sugerido = precoSugerido(custoPorUnidade, minutosPorUnidade, d(20))
    expect(sugerido.toFixed(2)).toBe('3.84')

    // A hora dela sai precificada a R$ 40 no total: R$ 20 de salário (custo)
    // + R$ 20 de lucro do negócio. As duas taxas SOMAM, e é por isso que elas
    // são campos separados em vez de um número só.
    const lucroPorUnidade = sugerido.minus(custoPorUnidade)
    expect(lucroPorUnidade.dividedBy(minutosPorUnidade).times(60).toFixed(2)).toBe('20.00')
  })
})
