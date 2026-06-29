import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.50', 'user-agent': 'vitest' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}))

import { checkEmailExists } from '@/lib/actions/auth'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser } from '../conftest'

describe('checkEmailExists — email-first cadastro (AUTH-02 / AUTH-03 / F1)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('returns { exists: true } for a registered, non-anonymized email', async () => {
    const u = await createTestUser({ email: 'ja-existe@example.com', role: 'customer' })
    const res = await checkEmailExists(u.email)
    expect(res.exists).toBe(true)
  })

  it('returns { exists: false } for an unknown email', async () => {
    const res = await checkEmailExists(`nunca-vi-${Date.now()}@example.com`)
    expect(res.exists).toBe(false)
  })

  it('is case-insensitive (typed uppercase still matches)', async () => {
    await createTestUser({ email: 'casing@example.com', role: 'customer' })
    const res = await checkEmailExists('  CASING@Example.com ')
    expect(res.exists).toBe(true)
  })

  it('treats an anonymized (deletedAt) account as non-existent so it can re-register', async () => {
    const u = await createTestUser({ email: 'anon@example.com', role: 'customer' })
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } })
    const res = await checkEmailExists('anon@example.com')
    expect(res.exists).toBe(false)
  })
})
