// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/components/footer'

/**
 * LGPD-06 + D-03: o footer global precisa expor o email do DPO em toda surface
 * pública/cliente e linkar Termos/Privacidade. (O footer NÃO aparece em /admin/* —
 * isso é garantido pela árvore de layouts: o footer vive no shell público, não no
 * root, então o route group (admin) nunca o herda. Ver SUMMARY.)
 */
describe('Footer global (LGPD-06, D-03)', () => {
  it('mostra o email do DPO dpo@luizinha-confeitaria.com.br', () => {
    render(<Footer />)
    expect(screen.getByText('dpo@luizinha-confeitaria.com.br')).toBeInTheDocument()
  })

  it('linka Termos (/termos) e Privacidade (/privacidade)', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/termos')
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    )
  })
})
