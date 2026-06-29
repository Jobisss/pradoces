import { Webhook } from 'svix'
import { env } from '@/lib/env'
import { logger } from '@/lib/log'

/**
 * Resend webhook receiver (first-instance svix-verified webhook).
 *
 * T-01-04-01 (Spoofing, block-on:high): the raw body (`request.text()` — svix
 * signs the exact bytes, so it MUST be read before any JSON parse) is verified
 * against the svix signature using RESEND_WEBHOOK_SECRET. An invalid/missing
 * signature is rejected with 400 BEFORE any processing.
 *
 * Phase 1 scope: verify + log only (event_type + email_id — no PII). Phase 4
 * persists into an `email_events` table and flags `account.email_invalid` on
 * persistent bounces.
 */
export async function POST(request: Request) {
  const payload = await request.text() // RAW body — svix verifies the exact bytes
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }

  try {
    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET)
    const event = wh.verify(payload, headers) as {
      type: string
      data: { email_id?: string }
    }
    // Phase 1: only log — no PII (pino redacts; we log event_type + email_id only).
    logger.info({ event_type: event.type, email_id: event.data?.email_id }, 'resend webhook')
    return Response.json({ ok: true })
  } catch {
    return new Response('invalid signature', { status: 400 })
  }
}
