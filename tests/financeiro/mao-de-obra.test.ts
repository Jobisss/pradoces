import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { custoMaoDeObra, computeLoteSnapshot } from '@/lib/custo/congelado'

const d = (v: string | number) => new Decimal(v)

/** Funções puras — esse arquivo roda sem banco. */
describe('custoMaoDeObra', () => {
  it('converte minutos em reais pela taxa horária', () => {
    // 90 min a R$ 20/h = 1,5h × 20 = R$ 30,00
    expect(custoMaoDeObra(90, d(1), d(20)).toFixed(2)).toBe('30.00')
  })

  it('escala pelo multiplicador — 2× a receita leva 2× o tempo', () => {
    expect(custoMaoDeObra(90, d(2), d(20)).toFixed(2)).toBe('60.00')
    expect(custoMaoDeObra(90, d('1.5'), d(20)).toFixed(2)).toBe('45.00')
  })

  it('receita sem tempo medido custa zero, igual gás ausente', () => {
    expect(custoMaoDeObra(null, d(1), d(20)).toNumber()).toBe(0)
    expect(custoMaoDeObra(undefined, d(1), d(20)).toNumber()).toBe(0)
    expect(custoMaoDeObra(0, d(1), d(20)).toNumber()).toBe(0)
  })

  it('valor/hora zero desliga a mão de obra sem quebrar a conta', () => {
    // É o estado do dia do deploy: a coluna nasce 0 e nada muda até ela configurar.
    expect(custoMaoDeObra(90, d(1), d(0)).toNumber()).toBe(0)
  })
})

describe('computeLoteSnapshot com mão de obra', () => {
  const linhas = [
    {
      compra: { id: 'c1', marca: 'Moça', custoPorUnidadeBase: d('0.01') },
      qtdeUsada: d(1000),
    },
  ]

  it('soma mão de obra ao custo total e ao custo por unidade', () => {
    // Ingrediente R$ 10,00 + gás R$ 2,00 + mão de obra R$ 30,00 = R$ 42,00
    const snap = computeLoteSnapshot({
      linhas,
      custoGas: d(2),
      custoMaoDeObra: custoMaoDeObra(90, d(1), d(20)),
      rendimentoReal: 30,
    })
    expect(snap.custoTotalCongelado).toBe('42.0000')
    expect(snap.custoMaoDeObraCongelado).toBe('30.0000')
    expect(snap.custoPorUnidadeCongelado).toBe('1.400000')
  })

  it('sem mão de obra o resultado é o de antes — nada quebra retroativamente', () => {
    const snap = computeLoteSnapshot({ linhas, custoGas: d(2), rendimentoReal: 30 })
    expect(snap.custoTotalCongelado).toBe('12.0000')
    expect(snap.custoMaoDeObraCongelado).toBe('0.0000')
    expect(snap.custoPorUnidadeCongelado).toBe('0.400000')
  })

  it('é a mão de obra que derruba a margem — o efeito que a mudança busca', () => {
    const semTrabalho = computeLoteSnapshot({ linhas, custoGas: d(2), rendimentoReal: 30 })
    const comTrabalho = computeLoteSnapshot({
      linhas,
      custoGas: d(2),
      custoMaoDeObra: custoMaoDeObra(90, d(1), d(20)),
      rendimentoReal: 30,
    })

    const preco = d(2)
    const margem = (custoUn: string) => preco.minus(custoUn).dividedBy(preco).times(100)

    // Vendendo a R$ 2,00: 80% de margem vira 30% quando o trabalho entra.
    expect(margem(semTrabalho.custoPorUnidadeCongelado).toFixed(0)).toBe('80')
    expect(margem(comTrabalho.custoPorUnidadeCongelado).toFixed(0)).toBe('30')
  })
})
