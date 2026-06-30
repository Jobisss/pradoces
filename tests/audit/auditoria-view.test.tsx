// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuditPage from '@/app/(admin)/admin/auditoria/page'
import { logAudit } from '@/lib/audit/log'
import { createTestUser, truncateAll } from '../conftest'

/**
 * Viewer de auditoria (AUTH-11): RSC que lista o audit_log em pt-BR descritivo,
 * mais recente no topo. Empty state com copy literal; ações traduzidas via
 * ACTION_COPY; metadata renderizada como texto (sem dangerouslySetInnerHTML).
 */
describe('/admin/auditoria viewer (AUTH-11)', () => {
  beforeEach(truncateAll)

  it('shows the empty state with literal copy when there are no events', async () => {
    render(await AuditPage())
    expect(screen.getByText('Nenhum evento ainda')).toBeInTheDocument()
    expect(
      screen.getByText(/Quando alguém entrar no painel ou mexer em alguma coisa importante/),
    ).toBeInTheDocument()
  })

  it('lists events most-recent-first with pt-BR ACTION_COPY', async () => {
    const admin = await createTestUser({ role: 'admin', email: `admin-${Date.now()}@x.com` })
    const cust = await createTestUser({ email: `cust-${Date.now()}@x.com` })

    await logAudit({ actorType: 'customer', actorId: cust.id, action: 'customer_signup' })
    await new Promise((r) => setTimeout(r, 10)) // ensure distinct ts ordering
    await logAudit({ actorType: 'admin', actorId: admin.id, action: 'admin_login' })

    render(await AuditPage())

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
    // ACTION_COPY pt-BR present
    expect(screen.getByText(/entrou no painel/)).toBeInTheDocument()
    expect(screen.getByText(/criou conta/)).toBeInTheDocument()
    // desc by ts: admin_login (later) before customer_signup (earlier)
    expect(items[0].textContent).toMatch(/entrou no painel/)
    expect(items[1].textContent).toMatch(/criou conta/)
  })
})
