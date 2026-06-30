import { describe, it, expect, beforeEach, vi } from 'vitest'

// resetPassword (Server Action) derives client context from next/headers and,
// on success, redirect()s. Stub both for the node runtime. Per-test mutable IP
// keeps the in-process rate limiter from bleeding across tests.
const ctx = vi.hoisted(() => ({ ip: '203.0.113.50' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-reset' }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Capture the reset token from the (otherwise fire-and-forget) email callback.
const captured = vi.hoisted(() => ({ token: '' }))
vi.mock('@/lib/email/send-password-reset', () => ({
  sendPasswordResetEmail: vi.fn(async ({ url }: { url: string }) => {
    // Better Auth emits the token as a path segment:
    //   .../api/auth/reset-password/<TOKEN>?callbackURL=...
    const m = url.match(/reset-password\/([^/?]+)/)
    captured.token = m ? decodeURIComponent(m[1]) : ''
  }),
}))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { auth } from '@/lib/auth/server'
import { resetPassword } from '@/lib/actions/auth'
import { prisma } from '@/lib/db/client'
import { signInAsCustomer, truncateAll } from '../conftest'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

describe('resetPassword OWASP (AUTH-05 — single-use + revoke)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
    captured.token = ''
  })

  it('resets the password, is single-use, and revokes the user sessions', async () => {
    const email = `reset-${Date.now()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'old-password-123', name: 'Reset User' } })

    // An open session that must be revoked by the reset (Pitfall #8).
    await signInAsCustomer(email)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(await prisma.session.count({ where: { userId: user.id } })).toBeGreaterThan(0)

    // Request the reset -> the mocked email callback captures the raw token.
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/redefinir-senha' } })
    expect(captured.token).toBeTruthy()

    // First use succeeds (action redirects on success -> no error returned).
    const r1 = await resetPassword(undefined, form({ token: captured.token, newPassword: 'new-password-456' }))
    expect(r1.error).toBeUndefined()

    // Sessions revoked.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)

    // Second use of the SAME token fails (single-use — verification consumed).
    const r2 = await resetPassword(undefined, form({ token: captured.token, newPassword: 'another-789' }))
    expect(r2.error).toBeTruthy()
  })
})
