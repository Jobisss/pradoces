import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { CartProvider } from '@/components/cart-provider'
import { CampanhaBanner } from '@/components/campanha-banner'
import { campanhaAtiva } from '@/lib/campanhas/definicoes'

/**
 * Shell público + cliente (D-03): Header global no topo, Footer com DPO embaixo.
 *
 * Por que aqui e não no root layout: o route group `(admin)` é irmão deste e tem
 * shell próprio (`app/(admin)/admin/layout.tsx`) sem footer. Colocando Header/Footer
 * neste layout de grupo (e NÃO no root), o segmento /admin/* nunca herda o footer
 * global — satisfaz D-03 sem checagem de pathname no server. Todas as surfaces
 * públicas e de cliente (landing, /termos, /privacidade, /minha-conta/*, e as páginas
 * de auth dos Plans 08/10) vivem sob este grupo para herdar o shell.
 *
 * SAZON-03/04 — paleta sazonal resolvida NO SERVER (campanhaAtiva() é uma
 * função pura de data, sem estado de cliente), então não tem flash de troca
 * de tema entre páginas nem entre navegações: cada request já renderiza com
 * a paleta certa. Escopo só em (public) — o admin não muda de cara sazonal,
 * é ferramenta de trabalho da mãe, não vitrine pro cliente.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const campanha = campanhaAtiva()

  return (
    <CartProvider>
      {campanha && (
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `:root{--primary:${campanha.paleta.primary};--primary-foreground:${campanha.paleta.primaryForeground};--secondary:${campanha.paleta.secondary};--secondary-foreground:${campanha.paleta.secondaryForeground};--accent:${campanha.paleta.accent};--accent-foreground:${campanha.paleta.accentForeground};--background:${campanha.paleta.background};}`,
          }}
        />
      )}
      <div className="flex min-h-full flex-col">
        <Header />
        {campanha && <CampanhaBanner texto={campanha.bannerTexto} />}
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  )
}
