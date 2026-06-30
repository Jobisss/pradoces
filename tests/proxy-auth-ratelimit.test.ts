import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import proxy from '../proxy'

/**
 * Boundary rate limit on the directly-reachable Better Auth catch-all
 * (app/api/auth/[...all]/route.ts). The proxy must throttle sensitive POSTs so a
 * brute-force against /api/auth/sign-in/email cannot bypass the Server Actions
 * (INFRA-04 / SC4, T-01-06-01).
 */
function post(path: string, ip: string, method = 'POST') {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'x-forwarded-for': ip },
  })
}

describe('proxy rate limit on /api/auth/* boundary (INFRA-04)', () => {
  it('blocks the 11th sensitive POST from the same IP with 429', async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 10; i++) {
      const res = await proxy(post('/api/auth/sign-in/email', ip))
      expect(res.status).not.toBe(429)
    }
    const eleventh = await proxy(post('/api/auth/sign-in/email', ip))
    expect(eleventh.status).toBe(429)
    const body = await eleventh.json()
    expect(body.message).toMatch(/muitas tentativas/i)
  })

  it('throttles forget-password POST too (shares the auth-ip budget)', async () => {
    const ip = `10.1.1.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 10; i++) {
      await proxy(post('/api/auth/forget-password', ip))
    }
    const blocked = await proxy(post('/api/auth/forget-password', ip))
    expect(blocked.status).toBe(429)
  })

  it('throttles reset-password POST (ME-03: reset-token brute-force)', async () => {
    const ip = `10.7.7.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 10; i++) {
      const res = await proxy(post('/api/auth/reset-password', ip))
      expect(res.status).not.toBe(429)
    }
    const blocked = await proxy(post('/api/auth/reset-password', ip))
    expect(blocked.status).toBe(429)
  })

  it('throttles verify-email even on GET (ME-03: token brute-force)', async () => {
    const ip = `10.8.8.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 10; i++) {
      const res = await proxy(post('/api/auth/verify-email?token=x', ip, 'GET'))
      expect(res.status).not.toBe(429)
    }
    const blocked = await proxy(post('/api/auth/verify-email?token=x', ip, 'GET'))
    expect(blocked.status).toBe(429)
  })

  it('does NOT throttle GET on /api/auth/* (only sensitive writes)', async () => {
    const ip = `10.2.2.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 15; i++) {
      const res = await proxy(post('/api/auth/get-session', ip, 'GET'))
      expect(res.status).not.toBe(429)
    }
  })

  it('does NOT throttle non-sensitive /api/auth/* POSTs (e.g. sign-out)', async () => {
    const ip = `10.3.3.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 15; i++) {
      const res = await proxy(post('/api/auth/sign-out', ip))
      expect(res.status).not.toBe(429)
    }
  })

  it('isolates IPs — a fresh IP is not blocked after another exhausts its budget', async () => {
    const hot = `10.4.4.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 11; i++) await proxy(post('/api/auth/sign-in/email', hot))
    const fresh = `10.5.5.${Math.floor(Math.random() * 250) + 1}`
    const res = await proxy(post('/api/auth/sign-in/email', fresh))
    expect(res.status).not.toBe(429)
  })

  it('leaves non-auth routes untouched (CSP still set, not throttled)', async () => {
    const ip = `10.6.6.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 15; i++) {
      const res = await proxy(post('/catalogo', ip, 'GET'))
      expect(res.status).not.toBe(429)
      expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    }
  })
})
