import { describe, it, expect, beforeEach, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ ip: '192.0.2.10' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { signinUser } from '@/lib/actions/auth'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

/** Create a real customer with a credential password, email already verified. */
async function createVerifiedCustomer(email: string, password: string) {
  await auth.api.signUpEmail({ body: { email, password, name: 'Cliente' } })
  await prisma.user.update({ where: { email }, data: { emailVerified: true, emailVerifiedAt: new Date() } })
}

describe('signinUser (AUTH-08 / INFRA-04)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`
  })

  it('signs in a verified customer with the correct password (no error returned)', async () => {
    const email = `login-${Date.now()}@example.com`
    await createVerifiedCustomer(email, 'minha-senha-123')

    const res = await signinUser(undefined, form({ email, password: 'minha-senha-123' }))
    // success path calls redirect() (mocked no-op) and returns no error
    expect(res?.error).toBeUndefined()
  })

  it('blocks the 11th attempt from the same IP within the window (defense in depth)', async () => {
    // Pin a fresh IP so prior tests did not consume this bucket.
    ctx.ip = `192.0.2.${100 + Math.floor(Math.random() * 150)}-rl-${Date.now()}`
    const fd = form({ email: `bruteforce-${Date.now()}@example.com`, password: 'errada-000' })

    let lastError: string | undefined
    for (let i = 0; i < 11; i++) {
      const res = await signinUser(undefined, fd)
      lastError = res?.error
    }
    expect(lastError).toBe('Muitas tentativas seguidas. Espera um minutinho e tenta de novo.')
  })
})
