import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { Button } from '@/components/ui/button'

/**
 * Landing da raiz `/` (D-01/D-02/D-04) — RSC, 3 variants por sessão.
 *
 * Placeholder narrativo de Phase 1 (Phase 3 troca por vitrine). Hero curto, voz de
 * vizinha (UI-SPEC §Brand & Voice), sem prometer prazo. Os CTAs trocam conforme a
 * sessão lida server-side (sem flicker, T-01-07-02).
 */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const role = session?.user.role

  async function signOut() {
    'use server'
    await auth.api.signOut({ headers: await nextHeaders() })
    redirect('/')
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center md:py-24">
      <p className="font-display text-4xl font-medium text-primary md:text-5xl">Doces Valentina</p>

      <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
        Em breve: reserva os doces caseiros da Valentina
      </h1>

      <div className="space-y-4 text-base text-muted-foreground">
        <p>
          A Valentina cozinha em casa, do jeito de sempre. Aqui você vai poder reservar os doces
          dela com antecedência — sem perder o carinho do atendimento no WhatsApp.
        </p>
        <p>
          Cria sua conta pra ser avisada(o) quando abrir, juntar pontos a cada reserva e garantir
          os seus favoritos antes que acabem.
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        {!session && (
          <>
            <Button asChild className="h-12 px-6 text-base">
              <Link href="/cadastro">Criar minha conta</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-6 text-base">
              <Link href="/entrar">Entrar</Link>
            </Button>
          </>
        )}

        {session && role !== 'admin' && (
          <>
            <Button asChild className="h-12 px-6 text-base">
              <Link href="/minha-conta/meus-dados">Minha conta</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-12 px-6 text-base">
                Sair
              </Button>
            </form>
          </>
        )}

        {session && role === 'admin' && (
          <>
            <Button asChild className="h-12 px-6 text-base">
              <Link href="/admin">Painel admin</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-12 px-6 text-base">
                Sair
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
