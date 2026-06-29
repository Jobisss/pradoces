import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { truncateAll, createTestUser } from '../conftest'
import { seedAdmin, resetAdmin } from '@/scripts/seed-admin'

/**
 * Integration tests for the admin bootstrap CLI (AUTH-10 / AUTH-11, D-05/D-07).
 *
 * These run against the real Postgres test DB (driver adapter) and exercise the
 * real Better Auth `signUpEmail` / admin-plugin `setUserPassword` +
 * `revokeUserSessions` paths — no mocks. The five must-have truths:
 *   1. seedAdmin() creates the single admin when none exists
 *   2. seedAdmin() is idempotent (no second admin on a re-run)
 *   3. resetAdmin() with exactly 1 admin changes the password + revokes sessions
 *   4. resetAdmin() throws with 0 admins
 *   5. resetAdmin() throws with >1 admins
 * Plus: neither path persists the plaintext password in audit_log.
 */
describe('seed-admin CLI (AUTH-10 / AUTH-11, D-05/D-07)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('seedAdmin() creates the single admin when none exists (D-05)', async () => {
    const res = await seedAdmin()
    expect(res.created).toBe(true)

    const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
    expect(admin).not.toBeNull()
    expect(admin?.email).toBe(env.ADMIN_EMAIL)
    expect(admin?.emailVerified).toBe(true)
    expect(admin?.isAdult).toBe(true)
    expect(admin?.termsVersion).toBe('v1.0-shell')
    expect(admin?.privacyVersion).toBe('v1.0-shell')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'admin_seed_via_cli' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.actorType).toBe('cli')
    expect(audit?.actorId).toBeNull()
    // The audit row records the email hash, NEVER the password (T-01-09-01).
    const meta = JSON.stringify(audit?.metadata ?? {})
    expect(meta).toMatch(/email_hash/)
    expect(meta).not.toContain(env.ADMIN_INITIAL_PASSWORD)
  })

  it('seedAdmin() is idempotent — a second run does not create a second admin', async () => {
    const first = await seedAdmin()
    expect(first.created).toBe(true)

    const second = await seedAdmin()
    expect(second.created).toBe(false)

    const count = await prisma.user.count({ where: { role: 'admin' } })
    expect(count).toBe(1)
  })

  it('resetAdmin() with exactly one admin changes the password and revokes sessions (D-07)', async () => {
    await seedAdmin()
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } })

    // An active session that the reset must revoke.
    await prisma.session.create({
      data: {
        userId: admin.id,
        token: `active-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const newPassword = 'nova-senha-bem-forte-123'
    const res = await resetAdmin({ resetPassword: newPassword })
    expect(res.adminId).toBe(admin.id)

    // All sessions for the admin are revoked.
    const sessions = await prisma.session.count({ where: { userId: admin.id } })
    expect(sessions).toBe(0)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'admin_password_reset_via_cli' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.actorType).toBe('cli')
    expect(audit?.actorId).toBeNull()
    const meta = JSON.stringify(audit?.metadata ?? {})
    expect(meta).toContain(admin.id)
    expect(meta).not.toContain(newPassword)
  })

  it('resetAdmin() throws when there is no admin', async () => {
    await expect(resetAdmin({ resetPassword: 'nova-senha-bem-forte-123' })).rejects.toThrow(
      /No admin/i,
    )
  })

  it('resetAdmin() throws when there is more than one admin', async () => {
    await createTestUser({ email: 'admin-1@example.com', role: 'admin' })
    await createTestUser({ email: 'admin-2@example.com', role: 'admin' })

    await expect(resetAdmin({ resetPassword: 'nova-senha-bem-forte-123' })).rejects.toThrow(
      /Multiple admins/i,
    )
  })
})
