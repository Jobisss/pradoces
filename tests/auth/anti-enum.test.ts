import { describe, it, expect, beforeEach, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.10' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))
vi.mock('@/lib/email/send-password-reset', () => ({
  sendPasswordResetEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { requestPasswordReset, signinUser } from '@/lib/actions/auth'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

const GENERIC_RESET =
  'Se esse email estiver cadastrado, você vai receber um link em alguns minutos. Verifique também o spam.'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

describe('anti-enumeration (AUTH-07)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
  })

  it('requestPasswordReset returns the same generic message for an UNKNOWN email', async () => {
    const res = await requestPasswordReset(undefined, form({ email: `ghost-${Date.now()}@example.com` }))
    expect(res.message).toBe(GENERIC_RESET)
    expect(res.error).toBeUndefined()
  })

  it('requestPasswordReset returns the same generic message for a KNOWN email', async () => {
    const email = `real-${Date.now()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'senha-bem-segura-123', name: 'Real' } })
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })

    const res = await requestPasswordReset(undefined, form({ email }))
    expect(res.message).toBe(GENERIC_RESET)
    expect(res.error).toBeUndefined()
  })

  it('signinUser returns the SAME generic credential error for an unknown email and a wrong password', async () => {
    // unknown email
    const r1 = await signinUser(undefined, form({ email: `nobody-${Date.now()}@example.com`, password: 'whatever-123' }))
    expect(r1.error).toBe('Email ou senha não conferem')

    // known email, wrong password
    const email = `known-${Date.now()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'senha-correta-123', name: 'Known' } })
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })
    const r2 = await signinUser(undefined, form({ email, password: 'senha-errada-999' }))
    expect(r2.error).toBe('Email ou senha não conferem')
    expect(r2.error).toBe(r1.error) // identical — no enumeration
  })
})
