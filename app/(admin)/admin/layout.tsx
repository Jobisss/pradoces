import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'

/**
 * Admin shell — DB role gate (2nd security layer; proxy.ts is the 1st).
 *
 * The route group `(admin)` makes `/admin/*` URLs without adding a path segment.
 * `await nextHeaders()` is async in Next 16 (Pitfall #3). A non-admin reaching
 * here is a customer who slipped past the cookie-presence check, so we render
 * the UI-SPEC 403 copy instead of redirecting (D-06).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) redirect('/admin/entrar')
  if (session.user.role !== 'admin') {
    return (
      <div style={{ padding: '32px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
        <h1>Essa parte é só pra administradora.</h1>
        <p>
          Se você é cliente, <a href="/minha-conta/meus-dados">vai pra sua conta</a>.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
