import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'

/**
 * Cliente shell — DB role gate (2nd security layer; proxy.ts is the 1st).
 *
 * D-06: the admin (mãe) has no `/minha-conta/*` — if she lands here she is
 * redirected to `/admin`. An anonymous visitor is sent to `/entrar`.
 * `await nextHeaders()` is async in Next 16 (Pitfall #3).
 */
export default async function MinhaContaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) redirect('/entrar')
  if (session.user.role === 'admin') redirect('/admin') // D-06: admin não tem /minha-conta
  return <>{children}</>
}
