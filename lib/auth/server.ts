import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { hashPassword, verifyPassword } from './argon2'
import { sendVerificationEmail } from '@/lib/email/send-verification'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset'
import { logAudit } from '@/lib/audit/log'

/**
 * Better Auth init — the security backbone for Plans 04-08.
 *
 * Critical invariants (RESEARCH.md §Auth Flows + Pitfalls):
 *   - `prismaAdapter(prisma, { provider: 'postgresql' })` reuses the Prisma 7
 *     driver-adapter singleton from `@/lib/db/client` (Plan 02).
 *   - `password.hash`/`password.verify` override the default scrypt with our
 *     argon2id OWASP profile-2 wrappers (T-Hash-01).
 *   - `additionalFields` MUST mirror the Prisma `User` model field names exactly
 *     (Pitfall #1): telefone, role, isAdult, terms/privacy version+acceptedAt.
 *   - `nextCookies()` MUST be the LAST plugin (Pitfall #1) so it can flush
 *     Set-Cookie headers after every other plugin has run.
 *   - `sendResetPassword`/`sendVerificationEmail` deliver real email via Resend
 *     (Plan 04). The sends are fire-and-forget (`void`) so they never block the
 *     Server Action (T-01-04-04); Phase 4 moves them onto pg-boss.
 *   - `onPasswordReset` writes a `customer_password_reset` audit event (AUTH-11).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // AUTH-04
    revokeSessionsOnPasswordReset: true, // AUTH-05 + Pitfall #8
    resetPasswordTokenExpiresIn: 3600, // 1 hour (OWASP 30-60min range)
    minPasswordLength: 8,
    password: {
      hash: hashPassword,
      verify: ({ hash: storedHash, password }) => verifyPassword(storedHash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      // Fire-and-forget (T-01-04-04): never block the Server Action on the
      // Resend round-trip. Phase 4 moves this onto pg-boss.
      void sendPasswordResetEmail({ to: user.email, url })
    },
    onPasswordReset: async ({ user }) => {
      // Repudiation mitigation (T-01-04-03 / AUTH-11). Admin self-reset happens
      // via CLI (D-07); a web reset here is always the customer themselves.
      // The base callback user type omits additionalFields; role is present at
      // runtime (declared in `user.additionalFields` + the Prisma model).
      const role = (user as { role?: string }).role
      await logAudit({
        actorType: role === 'admin' ? 'admin' : 'customer',
        actorId: user.id,
        action: 'customer_password_reset',
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60 * 24, // 24h — AUTH-04: copy promete 24 horas; default Better Auth é 1h
    sendVerificationEmail: async ({ user, url }) => {
      // Fire-and-forget (T-01-04-04). Phase 4 moves this onto pg-boss.
      void sendVerificationEmail({ to: user.email, url })
    },
  },
  user: {
    additionalFields: {
      telefone: { type: 'string', required: false },
      role: { type: 'string', required: false, defaultValue: 'customer' },
      isAdult: { type: 'boolean', required: false, defaultValue: false },
      termsVersion: { type: 'string', required: false },
      termsAcceptedAt: { type: 'date', required: false },
      privacyVersion: { type: 'string', required: false },
      privacyAcceptedAt: { type: 'date', required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh after 1 day
    cookieCache: { enabled: false },
  },
  advanced: {
    database: {
      // Let Postgres generate ids via Prisma's `@default(uuid())` so they fit the
      // `@db.Uuid` columns. Better Auth's default id generator emits non-UUID
      // strings that would violate the uuid column type.
      generateId: false,
    },
  },
  plugins: [
    // adds role support, setUserPassword, revokeUserSessions APIs.
    // defaultRole/adminRoles MUST align with the Prisma `Role` enum
    // (admin | customer). Without this the plugin writes role='user' on signup,
    // which is invalid for our enum (PrismaClientValidationError).
    admin({ defaultRole: 'customer', adminRoles: ['admin'] }),
    nextCookies(), // MUST be last per Pitfall #1 enforcement
  ],
})

export type Auth = typeof auth
