import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { rateLimitAuth } from '@/lib/ratelimit/memory'

/**
 * Next 16 Proxy (replaces `middleware.ts`).
 *
 * Two responsibilities (2-layer security — Pitfall #2):
 *   1. Fast, DB-free guard: per-request CSP nonce + cookie-PRESENCE check for
 *      /admin/* and /minha-conta/*. No DB hit here — `getSessionCookie` only
 *      proves a cookie exists, never that it's valid.
 *   2. The thorough DB role check lives in the route-group layouts
 *      (app/(admin)/admin/layout.tsx + app/minha-conta/layout.tsx) via
 *      `auth.api.getSession`.
 *
 * Proxy defaults to the Node.js runtime in Next 16, so `crypto` is available.
 * HSTS is intentionally NOT set here — Caddy owns it (Plan 08) to avoid a
 * duplicate header.
 */
export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // Boundary rate limit (INFRA-04, T-01-06-01): the Better Auth catch-all
  // (app/api/auth/[...all]/route.ts) is directly reachable, so a brute-force on
  // /api/auth/sign-in/email would bypass the Server Actions. Throttle the
  // sensitive write paths here at the edge (10/60s per IP). Defense in depth:
  // Plan 08 Server Actions consume the same in-process limiter.
  if (request.method === 'POST' && pathname.startsWith('/api/auth')) {
    const sensitive =
      pathname.includes('/sign-in/email') || pathname.includes('/forget-password')
    if (sensitive) {
      const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
      try {
        await rateLimitAuth.consume(ip)
      } catch {
        return new NextResponse(
          JSON.stringify({ message: 'Muitas tentativas seguidas. Tenta de novo daqui a pouco.' }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        )
      }
    }
  }

  // Cookie-presence layer ONLY — DB session validation happens in layouts (Pitfall #2).
  if (pathname.startsWith('/admin') && pathname !== '/admin/entrar') {
    if (!sessionCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/entrar'
      return NextResponse.redirect(url)
    }
  }
  if (pathname.startsWith('/minha-conta')) {
    if (!sessionCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/entrar'
      return NextResponse.redirect(url)
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // Strict-Transport-Security set by Caddy (Plan 08), not here
  return response
}

export const config = {
  matcher: [
    // Run on every request EXCEPT static assets / _next internals / public files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
