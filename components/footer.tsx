/**
 * Footer global (D-03 + LGPD-06) — RSC estático.
 *
 * Renderizado pelo shell público (`app/(public)/layout.tsx`), NÃO pelo root layout,
 * para que o route group `(admin)` nunca o herde (D-03: footer ausente em /admin/*).
 *
 * Layout: 1 linha em mobile (wrap natural), 2 linhas em ≥md. Usa <a> simples (páginas
 * legais de navegação completa) — evita dependência de router context.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-card px-4 py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 text-center md:flex-row md:justify-between md:gap-4 md:text-left">
        <p className="font-display text-base text-foreground">Doces Valentina</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="/termos" className="underline-offset-2 hover:underline">
            Termos
          </a>
          <a href="/privacidade" className="underline-offset-2 hover:underline">
            Privacidade
          </a>
          <span>
            Dúvidas sobre seus dados?{' '}
            <a href="mailto:dpo@docesvalentina.com.br" className="text-primary underline underline-offset-2">dpo@docesvalentina.com.br</a>
          </span>
        </nav>
      </div>
    </footer>
  )
}
