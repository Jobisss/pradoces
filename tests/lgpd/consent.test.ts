import { describe, it, expect, beforeEach, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ ip: '203.0.113.200' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { signupCustomer } from '@/lib/actions/auth'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

describe('LGPD consent capture (LGPD-01 / LGPD-02)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
  })

  it('REJECTS signup when +18 (isAdult) is not checked — no user is created (LGPD-01)', async () => {
    const email = `under18-${Date.now()}@example.com`
    const res = await signupCustomer(undefined, form({
      email,
      password: 'senha-bem-segura-123',
      nome: 'Sem Idade',
      telefone: '11999990000',
      // isAdult intentionally omitted
      termsAccepted: 'on',
    }))

    expect(res?.error).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).toBeNull() // hard block — nothing persisted
  })

  it('REJECTS signup when the terms checkbox is not accepted (LGPD-02)', async () => {
    const email = `noterms-${Date.now()}@example.com`
    const res = await signupCustomer(undefined, form({
      email,
      password: 'senha-bem-segura-123',
      nome: 'Sem Termos',
      telefone: '11999990001',
      isAdult: 'on',
      // termsAccepted intentionally omitted
    }))

    expect(res?.error).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).toBeNull()
  })

  it('stamps versioned consent (v1.0-shell) + accepted_at timestamps on a valid signup (LGPD-02)', async () => {
    const email = `consent-${Date.now()}@example.com`
    await signupCustomer(undefined, form({
      email,
      password: 'senha-bem-segura-123',
      nome: 'Com Consentimento',
      telefone: '11999990002',
      isAdult: 'on',
      termsAccepted: 'on',
    }))

    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(user.isAdult).toBe(true)
    expect(user.termsVersion).toBe('v1.0-shell')
    expect(user.privacyVersion).toBe('v1.0-shell')
    expect(user.termsAcceptedAt).toBeInstanceOf(Date)
    expect(user.privacyAcceptedAt).toBeInstanceOf(Date)
  })
})
