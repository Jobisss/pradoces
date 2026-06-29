import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the real Resend send so signup never hits the network — we only assert
// that the Better Auth verification callback fires with the right address.
const { sendVerificationEmail } = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(async (_args: { to: string; url: string }) => ({
    data: { id: 'mock' },
    error: null,
  })),
}))
vi.mock('@/lib/email/send-verification', () => ({ sendVerificationEmail }))

import { auth } from '@/lib/auth/server'
import { truncateAll } from '../conftest'

describe('email verification wiring (AUTH-04)', () => {
  beforeEach(async () => {
    await truncateAll()
    sendVerificationEmail.mockClear()
  })

  it('signup triggers a real verification email send for the new user', async () => {
    const email = `verify-${Date.now()}@example.com`
    await auth.api.signUpEmail({
      body: { email, password: 'senha-bem-segura-123', name: 'Cliente Teste' },
    })

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1)
    const arg = sendVerificationEmail.mock.calls[0][0]
    expect(arg.to).toBe(email)
    expect(typeof arg.url).toBe('string')
    expect(arg.url.length).toBeGreaterThan(0)
  })

  it('verification token window is 24h (emailVerification.expiresIn)', () => {
    expect(auth.options.emailVerification?.expiresIn).toBe(60 * 60 * 24)
  })
})
