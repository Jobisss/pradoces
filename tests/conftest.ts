/**
 * Shared test fixtures.
 *
 * Wave 0 (Plan 02 — Prisma) implements the DB-backed fixtures:
 *   - createTestUser, truncateAll
 * Plan 03 (Better Auth) implements the auth fixtures:
 *   - signInAsCustomer, signInAsAdmin, generateResetToken
 *
 * Auth-fixture strategy: instead of going through Better Auth's password
 * sign-in (our test users have no password/account row), we create a Session
 * row directly and forge the *exact* signed cookie Better Auth expects, so
 * `auth.api.getSession({ headers })` validates and returns the session.
 *
 * Better Auth signs the session-token cookie as
 *   encodeURIComponent(`${token}.${base64(HMAC-SHA256(secret, token))}`)
 * under cookie name `better-auth.session_token` (dev; the `__Secure-` prefix is
 * only added when cookies are `secure`, i.e. in PROD). See
 * better-call/dist/crypto.mjs `signCookieValue`.
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db/client'

/** Better Auth session cookie name in dev (no __Secure- prefix). */
const SESSION_COOKIE_NAME = 'better-auth.session_token'

/** Re-create Better Auth's signed-cookie value for a raw session token. */
async function signSessionToken(token: string): Promise<string> {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('test fixture: BETTER_AUTH_SECRET not set')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return encodeURIComponent(`${token}.${b64}`)
}

async function createSignedSession(
  userId: string,
): Promise<{ cookie: string; sessionToken: string }> {
  const sessionToken = `test-session-${randomUUID()}`
  await prisma.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  })
  const signed = await signSessionToken(sessionToken)
  return { cookie: `${SESSION_COOKIE_NAME}=${signed}`, sessionToken }
}

async function resolveUser(userIdOrEmail: string) {
  const user = userIdOrEmail.includes('@')
    ? await prisma.user.findUnique({ where: { email: userIdOrEmail } })
    : await prisma.user.findUnique({ where: { id: userIdOrEmail } })
  return user
}

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

/**
 * Mint a valid signed session cookie for an existing user (by id or email).
 * The returned `cookie` works directly as a `cookie:` header for
 * `auth.api.getSession`. Role enforcement is the caller's concern.
 */
export async function signInAsCustomer(
  userIdOrEmail: string,
): Promise<{ cookie: string; sessionToken: string }> {
  const user = await resolveUser(userIdOrEmail)
  if (!user) throw new Error('test fixture: user not found for signInAsCustomer')
  return createSignedSession(user.id)
}

/** Like signInAsCustomer, but asserts the user actually has role='admin'. */
export async function signInAsAdmin(
  userIdOrEmail: string,
): Promise<{ cookie: string; sessionToken: string }> {
  const user = await resolveUser(userIdOrEmail)
  if (!user) throw new Error('test fixture: user not found for signInAsAdmin')
  if (user.role !== 'admin') {
    throw new Error(`test fixture: signInAsAdmin called on user with role=${user.role}`)
  }
  return createSignedSession(user.id)
}

/**
 * Create a password-reset token row (mirrors the forgot-password flow) so reset
 * tests in Plans 04+ can exercise `auth.api.resetPassword`.
 */
export async function generateResetToken(userId: string): Promise<string> {
  const token = `reset-${randomUUID()}`
  await prisma.verification.create({
    data: {
      userId,
      identifier: 'reset-password',
      value: token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
    },
  })
  return token
}
