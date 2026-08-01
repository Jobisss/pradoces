import { describe, it, expect } from 'vitest'
import { zDecimalBRL, zQtdeBRL } from '@/lib/validation/decimal'

describe('zDecimalBRL (ING-03 money parsing)', () => {
  it('parses comma decimal', () => {
    const r = zDecimalBRL.parse('5,80')
    expect(r.toFixed(4)).toBe('5.8000')
  })

  it('parses dot decimal', () => {
    const r = zDecimalBRL.parse('5.80')
    expect(r.toFixed(4)).toBe('5.8000')
  })

  it('parses small unit costs at 4 decimal places', () => {
    const r = zDecimalBRL.parse('0,0147')
    expect(r.toFixed(4)).toBe('0.0147')
  })

  it('accepts up to 13 integer digits and 4 decimal digits', () => {
    const r = zDecimalBRL.parse('1234567890123,4567')
    expect(r.toFixed(4)).toBe('1234567890123.4567')
  })

  it.each(['', 'abc', '5,80,90', '-5', '5e3', '1.234,56'])(
    'rejects %s',
    (input) => {
      expect(() => zDecimalBRL.parse(input)).toThrow()
    },
  )

  it('uses the exact UI-SPEC error message', () => {
    const result = zDecimalBRL.safeParse('abc')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Esse número não parece certo. Usa vírgula pros centavos: 5,80',
      )
    }
  })
})

describe('zQtdeBRL (quantity parsing, 3 decimal places)', () => {
  it('parses comma decimal quantity', () => {
    const r = zQtdeBRL.parse('395,5')
    expect(r.toFixed(3)).toBe('395.500')
  })

  it('accepts up to 3 decimal digits', () => {
    const r = zQtdeBRL.parse('333,333')
    expect(r.toFixed(3)).toBe('333.333')
  })

  it('rejects 4+ decimal digits', () => {
    expect(() => zQtdeBRL.parse('1,2345')).toThrow()
  })
})
