import { describe, it, expect, beforeEach, vi } from 'vitest'

// The cadastro Server Actions derive client context from next/headers and, on
// success, `redirect()` via next/navigation. In the test (node) runtime there is
// no request scope, so we stub both: `headers`/`cookies` are provided, and
// `redirect` is a no-op so the action returns normally after its side effects.
const ctx = vi.hoisted(() => ({ ip: '203.0.113.10', ua: 'vitest-signup' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': ctx.ua }),
  cookies: async () => ({
    set: () => {},
    get: () => undefined,
    getAll: () => [],
    delete: () => {},
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Resend send is fire-and-forget inside Better Auth — stub it so signup never
// hits the network.
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

describe('signupCustomer (AUTH-01 / LGPD-01 / LGPD-02 / AUTH-11)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
  })

  it('creates User + credential Account and stamps telefone + LGPD consent', async () => {
    const email = `signup-${Date.now()}@example.com`
    await signupCustomer(undefined, form({
      email,
      password: 'senha-bem-segura-123',
      nome: 'Maria das Dores',
      telefone: '11999998888',
      isAdult: 'on',
      termsAccepted: 'on',
    }))

    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    })
    expect(user).not.toBeNull()
    expect(user!.role).toBe('customer') // never admin via signup (T-01-08-02b)
    expect(user!.telefone).toBe('11999998888')
    expect(user!.isAdult).toBe(true)
    expect(user!.termsVersion).toBe('v1.0-shell')
    expect(user!.privacyVersion).toBe('v1.0-shell')
    expect(user!.termsAcceptedAt).not.toBeNull()
    expect(user!.privacyAcceptedAt).not.toBeNull()
    // credential account with an argon2id hash (never plaintext)
    const cred = user!.accounts.find((a) => a.providerId === 'credential')
    expect(cred).toBeDefined()
    expect(cred!.password).toBeTruthy()
    expect(cred!.password).not.toContain('senha-bem-segura-123')
  })

  it('writes a customer_signup audit row (hashed IP/UA, never plaintext)', async () => {
    const email = `signup-audit-${Date.now()}@example.com`
    await signupCustomer(undefined, form({
      email,
      password: 'senha-bem-segura-123',
      nome: 'Joana',
      telefone: '11988887777',
      isAdult: 'on',
      termsAccepted: 'on',
    }))

    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const audit = await prisma.auditLog.findFirst({ where: { action: 'customer_signup' } })
    expect(audit).not.toBeNull()
    expect(audit!.actorType).toBe('customer')
    expect(audit!.actorId).toBe(user.id)
    // IP hash is sha256 hex (64 chars), not the raw ip
    expect(audit!.ipHash).toMatch(/^[a-f0-9]{64}$/)
    expect(audit!.ipHash).not.toBe(ctx.ip)
  })
})
