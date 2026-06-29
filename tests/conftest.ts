/**
 * Shared test fixtures.
 *
 * Wave 0 (Plan 02 — Prisma) implements the DB-backed fixtures:
 *   - createTestUser, truncateAll
 * Plan 03 (Better Auth) implements the auth fixtures:
 *   - signInAsCustomer, signInAsAdmin, generateResetToken
 *
 * The auth fixtures still throw until Plan 03 lands, so a test that relies on
 * an unimplemented fixture fails loudly instead of silently.
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db/client'

export async function createTestUser(opts?: {
  email?: string
  role?: 'admin' | 'customer'
  isAdult?: boolean
}): Promise<{ id: string; email: string }> {
  const email = opts?.email ?? `test-${randomUUID()}@example.com`
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test User',
      role: opts?.role ?? 'customer',
      isAdult: opts?.isAdult ?? true,
      termsVersion: 'v1.0-shell',
      termsAcceptedAt: new Date(),
      privacyVersion: 'v1.0-shell',
      privacyAcceptedAt: new Date(),
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
  return { id: user.id, email: user.email }
}

export async function truncateAll(): Promise<void> {
  // Children first (FK order), users last. Atomic — no orphaned rows.
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

// Plan 03 implements these (depends on Better Auth):
export async function signInAsCustomer(userId: string): Promise<{ cookie: string }> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}

export async function signInAsAdmin(userId: string): Promise<{ cookie: string }> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}

export async function generateResetToken(userId: string): Promise<string> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}
