import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { LogOutIcon } from 'lucide-react'
import { auth } from '@/lib/auth/server'
import { Button } from '@/components/ui/button'
import { CartBadge } from '@/components/cart-badge'

/**
 * Header global — RSC que lê a sessão server-side (D-02/D-04, T-01-07-02: sem flicker,
 * sem expor a role em atributo client). Troca os CTAs do canto direito conforme:
 *   - sem sessão (D-01): "Entrar" (outline) + "Criar minha conta" (primary)
 *   - cliente (D-02): "Minha conta" (primary) + "Sair"
 *   - admin (D-04): atalho ao painel (primary) + "Sair" — permite à mãe ver o site
 *     como cliente sem deslogar.
 *
 * Logout via server action chamando auth.api.signOut (limpa o cookie via nextCookies).
 *
 * ORÇAMENTO DE LARGURA NO CELULAR (medido no browser, fonte Geist real).
 * Nada aqui encolhe — logo, carrinho e botões são todos `shrink-0` por padrão —
 * então excedente não espreme: vira scroll horizontal no SITE INTEIRO. Os três
 * estados estouravam 390px: deslogado pedia 446px, cliente 390, admin 394.
 *
 * A regra que resolve: no celular, no máximo UM botão com texto.
 *   deslogado  logo 92 + carrinho 44 + "Entrar" 88 ....................... 254px
 *   cliente    logo 92 + carrinho 44 + "Minha conta" 129 + Sair ícone 44 .. 350px
 *   admin      logo 92 + carrinho 44 + "Painel" 90 + Sair ícone 44 ....... 304px
 * (+ padding 24 e gaps 6, já somados). Folga em 360px: 106 / 10 / 56.
 *
 * "Sair" vira ícone em vez de sumir porque NÃO existe logout dentro de
 * /minha-conta/* — escondê-lo prenderia o cliente logado no celular.
 * "Criar minha conta" pode sumir: /entrar já linka pra /cadastro.
 * Piso real assumido é 360px; em 320px (iPhone SE de 2016) o estado cliente
 * ainda passa 30px — fora do alvo, e o resto da vitrine já não serve essa tela.
 */
/**
 * "Sair" — quadrado de 44px só com ícone no celular, texto a partir de `sm`.
 * O `aria-label` fica nos dois casos: leitor de tela nunca depende do
 * breakpoint pra saber o que o botão faz.
 */
function SairBotao({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="outline"
        aria-label="Sair da conta"
        className="size-11 p-0 text-base sm:h-11 sm:w-auto sm:px-5"
      >
        <LogOutIcon className="size-5 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </form>
  )
}

export async function Header() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const role = session?.user.role

  async function signOut() {
    'use server'
    await auth.api.signOut({ headers: await nextHeaders() })
    redirect('/')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4 md:h-16 md:px-8">
      <Link href="/" className="flex shrink-0 items-center">
        <Image
          src="/logo/logo-header.png"
          alt="Luizinha Confeitaria"
          width={700}
          height={306}
          priority
          className="h-10 w-auto md:h-12"
        />
      </Link>

      <nav className="flex items-center gap-1.5 sm:gap-2">
        <CartBadge />

        {!session && (
          <>
            <Button asChild variant="outline" className="h-11 px-5 text-base">
              <Link href="/entrar">Entrar</Link>
            </Button>
            <Button asChild className="hidden h-11 px-5 text-base sm:inline-flex">
              <Link href="/cadastro">Criar minha conta</Link>
            </Button>
          </>
        )}

        {session && role !== 'admin' && (
          <>
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/minha-conta/meus-dados">Minha conta</Link>
            </Button>
            <SairBotao action={signOut} />
          </>
        )}

        {session && role === 'admin' && (
          <>
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/admin">
                <span className="sm:hidden">Painel</span>
                <span className="hidden sm:inline">Painel admin</span>
              </Link>
            </Button>
            <SairBotao action={signOut} />
          </>
        )}
      </nav>
    </header>
  )
}
