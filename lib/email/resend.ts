import { Resend } from 'resend'
import { env } from '@/lib/env'

/**
 * Resend SDK singleton (first-instance — RESEARCH §Email Infra).
 *
 * Phase 2+ imports `import { resend } from '@/lib/email/resend'` — never
 * instantiates a new `Resend` client. The API key is validated at boot by
 * `lib/env.ts` (`startsWith('re_')`).
 */
export const resend = new Resend(env.RESEND_API_KEY)
