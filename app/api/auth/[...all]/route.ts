import { auth } from '@/lib/auth/server'
import { toNextJsHandler } from 'better-auth/next-js'

/**
 * Better Auth catch-all (directly reachable HTTP surface).
 *
 * HI-02 — the public `sign-up/email` endpoint is DISABLED at this HTTP boundary.
 * The LGPD-01/LGPD-02 consent capture (isAdult, terms/privacy versions+timestamps,
 * telefone) lives in the `signupCustomer` Server Action, which calls
 * `auth.api.signUpEmail` server-side (NOT through this route). A direct POST to
 * `/api/auth/sign-up/email` would otherwise create a fully valid, consent-less
 * customer that becomes operable once email-verified — silently defeating the
 * consent hard block. Trusted server-side callers (the Server Action, the
 * seed-admin CLI, tests) use `auth.api.*` directly and are unaffected.
 */
const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

export async function POST(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname.endsWith('/sign-up/email') || pathname.endsWith('/sign-up')) {
    return new Response(
      JSON.stringify({ message: 'O cadastro acontece pela tela de cadastro do site.' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )
  }
  return handlers.POST(request)
}
