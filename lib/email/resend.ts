import { Resend } from 'resend'

/**
 * Resend SDK singleton (first-instance — RESEARCH §Email Infra).
 *
 * Phase 2+ imports `import { resend } from '@/lib/email/resend'` — never
 * instantiates a new `Resend` client.
 *
 * Why read `process.env.RESEND_API_KEY` directly instead of importing `lib/env`:
 * this module sits in the auth import chain (`lib/auth/server.ts` ->
 * `send-verification`/`send-password-reset` -> here), which Server Components and
 * Server Actions pull in. Routing through the t3-env proxy would perform a
 * server-var ACCESS at module-load; under jsdom (component tests) t3-env treats a
 * module-load access as a CLIENT access and throws
 * ("Attempted to access a server-side environment variable on the client"). The
 * raw `process.env` read is the sanctioned carve-out already used by
 * `lib/db/client.ts` and `lib/log.ts`. `lib/env` still validates `RESEND_API_KEY`
 * at build/boot time via `next.config.ts` (`startsWith('re_')`).
 */
export const resend = new Resend(process.env.RESEND_API_KEY)
