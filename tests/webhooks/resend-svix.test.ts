import { describe, it, expect } from 'vitest'
import { Webhook } from 'svix'
import { POST } from '@/app/api/webhooks/resend/route'
import { env } from '@/lib/env'

/**
 * Resend webhook svix-signature enforcement (T-01-04-01, block-on:high).
 * The handler must reject any payload that is not signed with the configured
 * RESEND_WEBHOOK_SECRET before doing any processing.
 */
function buildRequest(body: string, headers: Record<string, string>) {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/webhooks/resend (svix verify)', () => {
  it('rejects a request with missing svix headers (400)', async () => {
    const res = await POST(buildRequest(JSON.stringify({ type: 'email.delivered' }), {}))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('invalid signature')
  })

  it('rejects a forged signature (400)', async () => {
    const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: 'forged' } })
    const res = await POST(
      buildRequest(payload, {
        'svix-id': 'msg_forged',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,bm90LWEtcmVhbC1zaWduYXR1cmU=',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts a correctly signed payload (200, { ok: true })', async () => {
    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'abc-123' },
    })
    const msgId = 'msg_2abc'
    const timestamp = new Date()
    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET)
    const signature = wh.sign(msgId, timestamp, payload)

    const res = await POST(
      buildRequest(payload, {
        'svix-id': msgId,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
