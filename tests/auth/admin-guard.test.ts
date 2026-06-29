import { describe, it, expect, beforeEach } from 'vitest'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsCustomer } from '../conftest'

describe('Admin guard 2-layer (AUTH-10, T-PrivEsc-01)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('auth.api.getSession returns null with no headers', async () => {
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })

  it('auth.api.getSession returns session with valid cookie', async () => {
    const u = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(u.id)
    const headers = new Headers({ cookie })
    const session = await auth.api.getSession({ headers })
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe(u.id)
    expect(session!.user.role).toBe('customer')
  })

  it('customer session does NOT pass admin role check', async () => {
    const u = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(u.id)
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session!.user.role).not.toBe('admin')
  })

  it('admin session passes admin role check', async () => {
    const u = await createTestUser({ role: 'admin' })
    const { cookie } = await signInAsCustomer(u.id) // re-uses session creation
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session!.user.role).toBe('admin')
  })

  it('expired session row is not returned by getSession', async () => {
    const u = await createTestUser({ role: 'customer' })
    // Create a session that expired 1h ago, signed the same way as a live one.
    const expiredToken = `expired-${Date.now()}`
    await prisma.session.create({
      data: {
        userId: u.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      },
    })
    const secret = process.env.BETTER_AUTH_SECRET!
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expiredToken))
    const signed = encodeURIComponent(
      `${expiredToken}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`,
    )
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: `better-auth.session_token=${signed}` }),
    })
    expect(session).toBeNull()
  })
})
