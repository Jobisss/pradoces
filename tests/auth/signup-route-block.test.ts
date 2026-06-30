import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/[...all]/route'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

/**
 * HI-02 — a direct POST to the Better Auth catch-all sign-up endpoint must NOT
 * create an account. Consent (isAdult/terms/privacy/telefone) is only captured by
 * the signupCustomer Server Action, so the public HTTP sign-up route is disabled
 * to prevent consent-less customer creation.
 */
function signupPost(path: string, email: string) {
  return POST(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'senha-bem-segura-123', name: 'Bypasser' }),
    }),
  )
}

describe('POST /api/auth/sign-up/email is blocked at the boundary (HI-02)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('returns 403 and creates no user for /sign-up/email', async () => {
    const email = `bypass-${Date.now()}@example.com`
    const res = await signupPost('/api/auth/sign-up/email', email)
    expect(res.status).toBe(403)
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('returns 403 for the bare /sign-up path too', async () => {
    const email = `bypass2-${Date.now()}@example.com`
    const res = await signupPost('/api/auth/sign-up', email)
    expect(res.status).toBe(403)
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('does not interfere with other auth POSTs (e.g. sign-out routes through)', async () => {
    const res = await POST(
      new Request('http://localhost/api/auth/sign-out', { method: 'POST' }),
    )
    // Whatever Better Auth returns, it is NOT our 403 block.
    expect(res.status).not.toBe(403)
  })
})
