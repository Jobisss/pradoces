import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { clientIp } from '@/lib/net/client-ip'
import proxy from '../../proxy'

/**
 * HI-01 — trusted client-IP resolution. Behind Cloudflare the leftmost
 * X-Forwarded-For value is attacker-controlled (Cloudflare APPENDS the real IP),
 * so the rate-limit key must come from CF-Connecting-IP / the rightmost XFF hop.
 */
describe('clientIp (HI-01)', () => {
  it('prefers CF-Connecting-IP over any client-supplied X-Forwarded-For', () => {
    const h = new Headers({
      'cf-connecting-ip': '198.51.100.5',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8, 198.51.100.5',
    })
    expect(clientIp(h)).toBe('198.51.100.5')
  })

  it('falls back to the RIGHTMOST XFF hop (closest trusted proxy), not the leftmost', () => {
    const h = new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })
    expect(clientIp(h)).toBe('203.0.113.9')
  })

  it('returns "unknown" when no forwarding headers are present', () => {
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe('proxy rate limit resists X-Forwarded-For spoofing (HI-01)', () => {
  it('keeps a single attacker bucketed by CF-Connecting-IP despite random leftmost XFF', async () => {
    const realIp = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
    const sign = (i: number) =>
      new NextRequest('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          // Attacker rotates the spoofable leftmost XFF on every request...
          'x-forwarded-for': `10.${i}.${i}.${i}`,
          // ...but Cloudflare pins the real client IP here.
          'cf-connecting-ip': realIp,
        },
      })

    for (let i = 0; i < 10; i++) {
      const res = await proxy(sign(i))
      expect(res.status).not.toBe(429)
    }
    // The 11th still lands in the SAME bucket -> blocked, despite a fresh XFF.
    const blocked = await proxy(sign(99))
    expect(blocked.status).toBe(429)
  })
})
