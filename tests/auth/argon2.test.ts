import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/argon2'

describe('argon2id wrapper (AUTH-06, T-Hash-01)', () => {
  it('hash + verify roundtrip succeeds for correct password', async () => {
    const pwd = 'SenhaForte123!'
    const stored = await hashPassword(pwd)
    expect(stored.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(stored, pwd)).toBe(true)
  })

  it('verify fails for wrong password', async () => {
    const stored = await hashPassword('correct-password-1')
    expect(await verifyPassword(stored, 'wrong-password')).toBe(false)
  })

  it('hash output uses argon2id (not argon2i, not argon2d)', async () => {
    const stored = await hashPassword('any')
    expect(stored).toMatch(/^\$argon2id\$/)
  })

  it('hash params encode m=19456, t=2, p=1', async () => {
    const stored = await hashPassword('test-params')
    // argon2 PHC string format: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
    expect(stored).toMatch(/m=19456/)
    expect(stored).toMatch(/t=2/)
    expect(stored).toMatch(/p=1/)
  })

  it('two hashes of same password produce different output (random salt)', async () => {
    const a = await hashPassword('same-pwd')
    const b = await hashPassword('same-pwd')
    expect(a).not.toBe(b)
  })
})
