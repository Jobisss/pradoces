// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// B1 proof: the admin-auth group is NOT guarded. If the login page (or its
// layout) called redirect(), this spy would catch it. It must NOT be called,
// otherwise /admin/entrar would loop with the Plan-03 guard.
const redirectMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import AdminAuthLayout from '@/app/(admin-auth)/layout'
import AdminEntrarPage from '@/app/(admin-auth)/admin/entrar/page'

/**
 * GET /admin/entrar SEM sessão deve renderizar o form de login (sem loop): a
 * cadeia de layout do grupo (admin-auth) NÃO chama getSession nem redirect.
 */
describe('/admin/entrar no-loop (B1)', () => {
  it('renders the admin login form without triggering a redirect', () => {
    render(
      <AdminAuthLayout>
        <AdminEntrarPage />
      </AdminAuthLayout>,
    )
    expect(screen.getByText('Entrar como administradora')).toBeInTheDocument()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
