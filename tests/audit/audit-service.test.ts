import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID, createHash } from 'node:crypto'
import { logAudit, hashPii } from '@/lib/audit/log'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

describe('logAudit (AUTH-11 foundation, T-01-04-02)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('persists one row and hashes raw IP/UA (never plaintext)', async () => {
    const actorId = randomUUID()
    await logAudit({
      actorType: 'customer',
      actorId,
      action: 'customer_signup',
      rawIp: '1.2.3.4',
      rawUa: 'x',
    })

    const rows = await prisma.auditLog.findMany()
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.action).toBe('customer_signup')
    expect(row.actorType).toBe('customer')
    expect(row.actorId).toBe(actorId)

    // IP/UA stored ONLY as a keyed HMAC hex — never plaintext (Pitfall #9), and
    // NOT a bare sha256 (ME-01: that would be brute-forceable for low-entropy IP/UA).
    expect(row.ipHash).not.toBe('1.2.3.4')
    expect(row.uaHash).not.toBe('x')
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.uaHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.ipHash).toBe(hashPii('1.2.3.4'))
    expect(row.uaHash).toBe(hashPii('x'))
    // The keyed HMAC must differ from an unsalted sha256 of the same input.
    expect(row.ipHash).not.toBe(createHash('sha256').update('1.2.3.4').digest('hex'))
  })

  it('accepts actorId:null with actorType cli (system events)', async () => {
    await logAudit({
      actorType: 'cli',
      actorId: null,
      action: 'admin_seed_via_cli',
      metadata: { email_hash: createHash('sha256').update('mae@example.com').digest('hex') },
    })

    const rows = await prisma.auditLog.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].actorId).toBeNull()
    expect(rows[0].actorType).toBe('cli')
    expect(rows[0].ipHash).toBeNull()
    expect(rows[0].uaHash).toBeNull()
  })

  it('uses pre-hashed ipHash/uaHash when provided (no double-hash)', async () => {
    const preHash = createHash('sha256').update('9.9.9.9').digest('hex')
    await logAudit({
      actorType: 'admin',
      actorId: randomUUID(),
      action: 'admin_login',
      ipHash: preHash,
    })
    const rows = await prisma.auditLog.findMany()
    expect(rows[0].ipHash).toBe(preHash)
  })
})
