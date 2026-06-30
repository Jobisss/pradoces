import { describe, it, expect, beforeEach, vi } from 'vitest'

// Capture whether the reset email was actually sent. The per-email cap lives in
// the Better Auth sendResetPassword chokepoint, so it must apply even to a
// direct auth.api.requestPasswordReset call (the HTTP /forget-password path).
const sent = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/lib/email/send-password-reset', () => ({
  sendPasswordResetEmail: vi.fn(async () => {
    sent.count += 1
    return { data: { id: 'mock' }, error: null }
  }),
}))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

describe('per-email reset throttle at the Better Auth chokepoint (ME-03)', () => {
  beforeEach(async () => {
    await truncateAll()
    sent.count = 0
  })

  it('caps password-reset emails to a known address at 3/15min, even via the direct API', async () => {
    const email = `bomb-${Date.now()}-${Math.random()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'senha-bem-segura-123', name: 'Vitima' } })
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })
    sent.count = 0 // ignore the signup verification email mock

    // 3 allowed within the window...
    for (let i = 0; i < 3; i++) {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: '/redefinir-senha' } })
    }
    expect(sent.count).toBe(3)

    // ...the 4th is throttled — no further email is dispatched to the victim.
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/redefinir-senha' } })
    expect(sent.count).toBe(3)
  })
})
