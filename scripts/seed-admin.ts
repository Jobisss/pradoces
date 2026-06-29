/**
 * Admin bootstrap + break-glass reset CLI (AUTH-10 / AUTH-11, D-05 / D-07).
 *
 *   pnpm seed:admin            -> create the single admin (idempotent)
 *   pnpm seed:admin --reset    -> rotate the admin password + revoke sessions
 *
 * Security invariants (threat_model T-01-09-01/02/03):
 *   - Passwords are read ONLY from env (ADMIN_INITIAL_PASSWORD / ADMIN_RESET_PASSWORD)
 *     and are NEVER printed or persisted in plaintext. The audit row records the
 *     admin id / email hash only.
 *   - --reset requires EXACTLY one admin (fails on 0 or >1); seed is idempotent.
 *   - Both paths append an audit event (actorType='cli', actorId=null).
 *
 * Why a forged admin session (forgeAdminSessionHeaders):
 *   Better Auth's admin plugin endpoints (set-user-password, revoke-user-sessions)
 *   run behind `adminMiddleware`, which calls `getAuthoritativeSessionFromCtx` and
 *   throws UNAUTHORIZED without a valid admin session in the request headers. The
 *   RESEARCH verbatim snippet called these APIs headerless, which throws at runtime
 *   in this Better Auth version. A CLI has no browser session, so we mint a short-
 *   lived session row for the target admin and sign the exact cookie Better Auth
 *   expects (standard-base64 HMAC, same scheme as better-call `signCookieValue` and
 *   the test fixtures). The cookie NAME is read from the live auth context so the
 *   `__Secure-` prefix is correct in production. The session-revoke call then drops
 *   that session along with every other — the forged session is single-use.
 */
import crypto, { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { logAudit } from '@/lib/audit/log'

const SEED_ACTION = 'admin_seed_via_cli'
const RESET_ACTION = 'admin_password_reset_via_cli'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Create the single admin (D-05). Idempotent: if an admin already exists this is
 * a no-op (use --reset to rotate the password). The password is read from
 * `ADMIN_INITIAL_PASSWORD`; the `opts.initialPassword` override exists only for
 * deterministic tests and is never used by the CLI entrypoint.
 */
export async function seedAdmin(opts?: {
  initialPassword?: string
}): Promise<{ created: boolean; id: string }> {
  const password = opts?.initialPassword ?? env.ADMIN_INITIAL_PASSWORD
  if (!password) throw new Error('ADMIN_INITIAL_PASSWORD required to seed the admin')

  const existing = await prisma.user.findFirst({ where: { role: 'admin', deletedAt: null } })
  if (existing) {
    console.log(`Admin já existe (${existing.email}). Use --reset para trocar a senha.`)
    return { created: false, id: existing.id }
  }

  // Public sign-up path (no session required) creates the User + credential Account.
  await auth.api.signUpEmail({
    body: { email: env.ADMIN_EMAIL, password, name: 'Administradora' },
  })

  // The admin skips the normal cadastro flow: promote to admin, mark verified,
  // and stamp the LGPD shells so the account is immediately operable.
  const user = await prisma.user.update({
    where: { email: env.ADMIN_EMAIL },
    data: {
      role: 'admin',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isAdult: true,
      termsVersion: 'v1.0-shell',
      termsAcceptedAt: new Date(),
      privacyVersion: 'v1.0-shell',
      privacyAcceptedAt: new Date(),
    },
  })

  await logAudit({
    actorType: 'cli',
    actorId: null,
    action: SEED_ACTION,
    metadata: { email_hash: sha256(env.ADMIN_EMAIL) },
  })

  console.log(`Admin criado: ${user.email}. Entregue a senha pessoalmente (D-05).`)
  return { created: true, id: user.id }
}

/**
 * Mint a short-lived signed session for `adminId` and return it as request
 * headers, so the admin-plugin endpoints (which require an admin session) can be
 * invoked from the CLI. The cookie name is resolved from the live auth context so
 * the production `__Secure-` prefix is honored.
 */
async function forgeAdminSessionHeaders(adminId: string): Promise<Headers> {
  const ctx = await auth.$context
  const cookieName = ctx.authCookies.sessionToken.name

  const token = `cli-reset-${randomUUID()}`
  await prisma.session.create({
    data: {
      userId: adminId,
      token,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min — single use
    },
  })

  // Standard-base64 HMAC over the token, matching better-call `signCookieValue`.
  const signature = crypto.createHmac('sha256', env.BETTER_AUTH_SECRET).update(token).digest('base64')
  const value = encodeURIComponent(`${token}.${signature}`)
  return new Headers({ cookie: `${cookieName}=${value}` })
}

/**
 * Break-glass admin password reset (D-07): rotate the password and revoke every
 * active session. Requires EXACTLY one admin — throws on 0 (use seed) or >1
 * (ambiguous, needs manual fix). The password is read from `ADMIN_RESET_PASSWORD`;
 * `opts.resetPassword` exists only for deterministic tests.
 */
export async function resetAdmin(opts?: {
  resetPassword?: string
}): Promise<{ adminId: string }> {
  const password = opts?.resetPassword ?? env.ADMIN_RESET_PASSWORD
  if (!password) throw new Error('ADMIN_RESET_PASSWORD required for --reset')

  const admins = await prisma.user.findMany({ where: { role: 'admin', deletedAt: null } })
  if (admins.length === 0) throw new Error('No admin found — run seed:admin (without --reset) first')
  if (admins.length > 1) throw new Error('Multiple admins found — manual fix required')
  const [admin] = admins

  const headers = await forgeAdminSessionHeaders(admin.id)
  await auth.api.setUserPassword({ headers, body: { userId: admin.id, newPassword: password } })
  await auth.api.revokeUserSessions({ headers, body: { userId: admin.id } })

  await logAudit({
    actorType: 'cli',
    actorId: null,
    action: RESET_ACTION,
    metadata: { admin_id: admin.id },
  })

  console.log('Senha do admin trocada; sessões ativas revogadas (D-07).')
  return { adminId: admin.id }
}

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    await resetAdmin()
  } else {
    await seedAdmin()
  }
}

// Run only when executed directly (`tsx scripts/seed-admin.ts`), never when the
// test suite imports the exported functions.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => {
      void prisma.$disconnect()
    })
}
