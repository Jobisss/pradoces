import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { hashPassword, verifyPassword } from './argon2'
import { logger } from '@/lib/log'

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
 *   - `sendResetPassword`/`sendVerificationEmail` are NOOP logs until Plan 04
 *     wires real Resend delivery.
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
      // Plan 04 wires real Resend send. For now log only.
      logger.info({ userId: user.id, url }, 'sendResetPassword (noop until Plan 04)')
    },
    onPasswordReset: async ({ user }) => {
      logger.info({ userId: user.id }, 'password reset complete')
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      // Plan 04 wires real Resend send. For now log only.
      logger.info({ userId: user.id, url }, 'sendVerificationEmail (noop until Plan 04)')
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
  plugins: [
    admin(), // adds role='admin' support, setUserPassword, revokeUserSessions APIs
    nextCookies(), // MUST be last per Pitfall #1 enforcement
  ],
})

export type Auth = typeof auth
