import { describe, it, expect } from 'vitest'
import { rateLimitAuth, rateLimitForgotEmail } from '@/lib/ratelimit/memory'

/**
 * In-memory rate limit instances (RESEARCH §Rate Limit, override Upstash).
 * `consume(key)` resolves while under budget and rejects (throws RateLimiterRes)
 * once the window is exhausted — the Server Action pattern wraps it in
 * `.catch(() => 'BLOCKED')`.
 */
describe('rateLimitAuth (10 req / 60s per IP)', () => {
  it('allows 10 consecutive consumes then blocks the 11th for the same key', async () => {
    const ip = `auth-${Date.now()}-${Math.random()}`
    for (let i = 0; i < 10; i++) {
      const res = await rateLimitAuth.consume(ip).catch(() => 'BLOCKED')
      expect(res).not.toBe('BLOCKED')
    }
    const eleventh = await rateLimitAuth.consume(ip).catch(() => 'BLOCKED')
    expect(eleventh).toBe('BLOCKED')
  })

  it('isolates distinct keys (one IP exhausting does not block another)', async () => {
    const ipA = `authA-${Date.now()}-${Math.random()}`
    const ipB = `authB-${Date.now()}-${Math.random()}`
    for (let i = 0; i < 10; i++) await rateLimitAuth.consume(ipA)
    const blockedA = await rateLimitAuth.consume(ipA).catch(() => 'BLOCKED')
    const freshB = await rateLimitAuth.consume(ipB).catch(() => 'BLOCKED')
    expect(blockedA).toBe('BLOCKED')
    expect(freshB).not.toBe('BLOCKED')
  })
})

describe('rateLimitForgotEmail (3 req / 15min per email)', () => {
  it('allows 3 consecutive consumes then blocks the 4th for the same email', async () => {
    const email = `forgot-${Date.now()}-${Math.random()}@example.com`
    for (let i = 0; i < 3; i++) {
      const res = await rateLimitForgotEmail.consume(email).catch(() => 'BLOCKED')
      expect(res).not.toBe('BLOCKED')
    }
    const fourth = await rateLimitForgotEmail.consume(email).catch(() => 'BLOCKED')
    expect(fourth).toBe('BLOCKED')
  })
})
