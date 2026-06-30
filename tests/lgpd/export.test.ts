import { describe, it, expect, beforeEach, vi } from 'vitest'

// The export route reads the session via auth.api.getSession({ headers: await
// nextHeaders() }). In the node test runtime there is no request scope, so we
// stub next/headers to return a Headers carrying the signed session cookie
// minted by the conftest fixture. `ctx.cookie = ''` exercises the no-session path.
const ctx = vi.hoisted(() => ({ cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(ctx.cookie ? { cookie: ctx.cookie } : {}),
}))

import { exportUserData } from '@/lib/lgpd/export'
import { GET } from '@/app/api/me/export/route'
import { prisma } from '@/lib/db/client'
import { createTestUser, signInAsCustomer, truncateAll } from '../conftest'

describe('exportUserData (LGPD-04 — whitelist, no secret leak)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.cookie = ''
  })

  it('returns the versioned export envelope with whitelisted cadastro fields', async () => {
    const email = `export-${Date.now()}@example.com`
    const u = await createTestUser({ email })

    const data = await exportUserData(u.id)

    expect(data.versao_export).toBe('1.0')
    expect(typeof data.gerado_em).toBe('string')
    expect(data.cadastro).not.toBeNull()
    expect(data.cadastro!.id).toBe(u.id)
    expect(data.cadastro!.email).toBe(email)
    // Phase 1: reservas/pontos are populated in Phase 4.
    expect(data.reservas).toEqual([])
    expect(data.pontos).toEqual([])
  })

  it('never exposes the credential password hash or tokens (select whitelist)', async () => {
    const email = `export-secret-${Date.now()}@example.com`
    const u = await createTestUser({ email })
    // A credential row whose password hash MUST NOT appear in the export.
    await prisma.account.create({
      data: {
        userId: u.id,
        accountId: u.id,
        providerId: 'credential',
        password: 'argon2id$super-secret-hash-value',
        accessToken: 'tok_should_never_export',
      },
    })

    const data = await exportUserData(u.id)
    const cadastro = data.cadastro as Record<string, unknown>

    expect('password' in cadastro).toBe(false)
    expect('accessToken' in cadastro).toBe(false)
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain('argon2id$super-secret-hash-value')
    expect(serialized).not.toContain('tok_should_never_export')
  })
})

describe('GET /api/me/export (auth gate + IDOR + headers)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.cookie = ''
  })

  it('returns 401 when there is no session', async () => {
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 200 with attachment + no-store and ONLY the own user data (no IDOR)', async () => {
    const aEmail = `owner-${Date.now()}@example.com`
    const bEmail = `victim-${Date.now()}@example.com`
    const a = await createTestUser({ email: aEmail })
    await createTestUser({ email: bEmail })

    const { cookie } = await signInAsCustomer(a.id)
    ctx.cookie = cookie

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()
    // Payload is derived from session.user.id, never an id from the request.
    expect(body.cadastro.email).toBe(aEmail)
    expect(JSON.stringify(body)).not.toContain(bEmail)
  })
})
