import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

// The delete route reads next/headers (session + IP/UA hashing) and, on success,
// redirect()s via next/navigation. Stub both for the node test runtime.
const ctx = vi.hoisted(() => ({ cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'vitest-delete',
    }),
}))
const redirectMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { anonymizeUser } from '@/lib/lgpd/anonymize'
import { POST } from '@/app/api/me/delete/route'
import { prisma } from '@/lib/db/client'
import { createTestUser, signInAsCustomer, truncateAll } from '../conftest'

async function seedCredentialsAndSession(userId: string) {
  await prisma.account.create({
    data: { userId, accountId: userId, providerId: 'credential', password: 'argon2id$hash' },
  })
  await prisma.session.create({
    data: {
      userId,
      token: `sess-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  })
}

describe('anonymizeUser (LGPD-05 — UPDATE not DELETE, revoke, audit)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.cookie = ''
    redirectMock.mockReset()
  })

  it('anonymizes by UPDATE preserving the id, revokes sessions+accounts, and audits', async () => {
    const email = `anon-${Date.now()}@example.com`
    const u = await createTestUser({ email })
    await seedCredentialsAndSession(u.id)

    await anonymizeUser(u.id, 'iphash-precomputed', 'uahash-precomputed')

    // T-01-11-02: the row still exists (UPDATE, not DELETE) — fiscal history kept.
    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after).not.toBeNull()
    expect(after!.email).toMatch(/@anon\.invalid$/)
    expect(after!.name).toBe('[anonimizado]')
    expect(after!.telefone).toBeNull()
    expect(after!.deletedAt).not.toBeNull()
    expect(after!.anonymizedAt).not.toBeNull()

    // T-01-11-03: credentials + sessions gone — cannot log in afterwards.
    expect(await prisma.account.count({ where: { userId: u.id } })).toBe(0)
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'customer_account_deleted' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.actorType).toBe('customer')
    expect(audit!.actorId).toBe(u.id)
  })

  it('frees the original email for re-registration (deletedAt set, address replaced)', async () => {
    const email = `reuse-${Date.now()}@example.com`
    const u = await createTestUser({ email })

    await anonymizeUser(u.id)

    // The original address no longer maps to any user -> checkEmailExists (Plan 08)
    // reports it as non-existent, so it can be registered again.
    const stillThere = await prisma.user.findUnique({ where: { email } })
    expect(stillThere).toBeNull()
  })
})

describe('POST /api/me/delete (auth gate + typed-email gate)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.cookie = ''
    redirectMock.mockReset()
  })

  function postWith(confirmacao: string) {
    const fd = new FormData()
    fd.set('confirmacao', confirmacao)
    return POST(new Request('http://localhost/api/me/delete', { method: 'POST', body: fd }))
  }

  it('returns 401 without a session', async () => {
    const res = await postWith('whatever@example.com')
    expect(res?.status).toBe(401)
  })

  it('returns 400 when the typed email does not match the session email', async () => {
    const u = await createTestUser({ email: `delete-${Date.now()}@example.com` })
    const { cookie } = await signInAsCustomer(u.id)
    ctx.cookie = cookie

    const res = await postWith('errado@example.com')
    expect(res?.status).toBe(400)
    // Nothing was anonymized.
    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after!.deletedAt).toBeNull()
  })

  it('anonymizes and redirects when the typed email matches', async () => {
    const email = `delete-ok-${Date.now()}@example.com`
    const u = await createTestUser({ email })
    await seedCredentialsAndSession(u.id)
    const { cookie } = await signInAsCustomer(u.id)
    ctx.cookie = cookie

    await postWith(email)

    expect(redirectMock).toHaveBeenCalledWith('/?msg=conta-excluida')
    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after!.anonymizedAt).not.toBeNull()
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0)
  })
})
