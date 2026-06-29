// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PrivacidadePage from '@/app/(public)/privacidade/page'

/**
 * LGPD-03 (art. 5 inc. VII + art. 33): a política de privacidade descritiva precisa
 * nomear os operadores reais com acesso aos dados e o prazo de retenção fiscal.
 * Sem operadores reais a política viola a lei (T-01-07-03).
 */
describe('Política de privacidade (LGPD-03)', () => {
  it('lista os operadores reais (Resend, Cloudflare, Hostinger) e retenção de 5 anos', () => {
    const { container } = render(<PrivacidadePage />)
    const text = container.textContent ?? ''
    expect(text).toContain('Resend')
    expect(text).toContain('Cloudflare')
    expect(text).toContain('Hostinger')
    expect(text).toContain('5 anos')
  })
})
