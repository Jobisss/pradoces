import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { Button } from '@/components/ui/button'

/**
 * Header global — RSC que lê a sessão server-side (D-02/D-04, T-01-07-02: sem flicker,
 * sem expor a role em atributo client). Troca os CTAs do canto direito conforme:
 *   - sem sessão (D-01): "Entrar" (outline) + "Criar minha conta" (primary)
 *   - cliente (D-02): "Minha conta" (primary) + "Sair"
 *   - admin (D-04): atalho ao painel (primary) + "Sair" — permite à mãe ver o site
 *     como cliente sem deslogar.
 *
 * Logout via server action chamando auth.api.signOut (limpa o cookie via nextCookies).
 */
export async function Header() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const role = session?.user.role

  async function signOut() {
    'use server'
    await auth.api.signOut({ headers: await nextHeaders() })
    redirect('/')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:h-16 md:px-8">
      <Link
        href="/"
        className="font-display text-[28px] leading-none font-medium text-foreground md:text-[32px]"
      >
        Luizinha Confeitaria
      </Link>

      <nav className="flex items-center gap-2">
        {!session && (
          <>
            <Button asChild variant="outline" className="h-11 px-5 text-base">
              <Link href="/entrar">Entrar</Link>
            </Button>
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/cadastro">Criar minha conta</Link>
            </Button>
          </>
        )}

        {session && role !== 'admin' && (
          <>
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/minha-conta/meus-dados">Minha conta</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-11 px-5 text-base">
                Sair
              </Button>
            </form>
          </>
        )}

        {session && role === 'admin' && (
          <>
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/admin">Painel admin</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-11 px-5 text-base">
                Sair
              </Button>
            </form>
          </>
        )}
      </nav>
    </header>
  )
}
