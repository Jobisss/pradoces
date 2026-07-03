import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { exportUserData } from '@/lib/lgpd/export'

/**
 * LGPD-04 — GET /api/me/export
 *
 * Streams the logged-in customer's own data as a downloadable JSON attachment.
 * Auth is mandatory (401 without a session); the payload is ALWAYS derived from
 * the server session, never from any id in the request (anti-IDOR, T-01-11-01).
 * `Cache-Control: no-store` keeps the PII export out of any shared cache
 * (T-01-11-04).
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const data = await exportUserData(session.user.id)
  const date = new Date().toISOString().split('T')[0]

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="luizinha-confeitaria-meus-dados-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
