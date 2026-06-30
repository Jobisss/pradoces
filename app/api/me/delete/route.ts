import crypto from 'node:crypto'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { anonymizeUser } from '@/lib/lgpd/anonymize'
import { DeleteAccountSchema } from '@/lib/validation/lgpd'

/**
 * LGPD-05 — POST /api/me/delete
 *
 * Anonymizes (never DELETEs) the logged-in customer's account. Two gates:
 *   1. Auth: 401 without a session.
 *   2. Typed-email confirmation: the form's `confirmacao` field must equal the
 *      SERVER session email (UI-SPEC: digitação física, sem dialog). The compare
 *      target comes from the session — never from the request body — so a user
 *      can only delete their own account (T-01-11-01). Mismatch -> 400.
 *
 * IP/UA are sha256-hashed before reaching anonymizeUser (never plaintext).
 */
export async function POST(request: Request) {
  const h = await nextHeaders()
  const session = await auth.api.getSession({ headers: h })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const formData = await request.formData()
  const parsed = DeleteAccountSchema.safeParse({ confirmacao: formData.get('confirmacao') })
  if (!parsed.success || parsed.data.confirmacao !== session.user.email) {
    return new Response('email não confere', { status: 400 })
  }

  const ipHash = crypto
    .createHash('sha256')
    .update(h.get('x-forwarded-for') ?? '')
    .digest('hex')
  const uaHash = crypto
    .createHash('sha256')
    .update(h.get('user-agent') ?? '')
    .digest('hex')

  await anonymizeUser(session.user.id, ipHash, uaHash)
  redirect('/?msg=conta-excluida')
}
