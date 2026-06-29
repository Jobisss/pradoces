import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

/**
 * Shell público + cliente (D-03): Header global no topo, Footer com DPO embaixo.
 *
 * Por que aqui e não no root layout: o route group `(admin)` é irmão deste e tem
 * shell próprio (`app/(admin)/admin/layout.tsx`) sem footer. Colocando Header/Footer
 * neste layout de grupo (e NÃO no root), o segmento /admin/* nunca herda o footer
 * global — satisfaz D-03 sem checagem de pathname no server. Todas as surfaces
 * públicas e de cliente (landing, /termos, /privacidade, /minha-conta/*, e as páginas
 * de auth dos Plans 08/10) vivem sob este grupo para herdar o shell.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
