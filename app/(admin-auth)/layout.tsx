/**
 * Grupo (admin-auth) — layout DELIBERADAMENTE NÃO-GUARDADO (B1).
 *
 * A página pública de login do admin (/admin/entrar) vive aqui, FORA do layout
 * guardado de `app/(admin)/admin/layout.tsx` (Plan 03). Aquele layout faz
 * `if (!session) redirect('/admin/entrar')` — se o /admin/entrar ficasse SOB ele,
 * visitar a página sem sessão entraria em LOOP infinito de redirect.
 *
 * Por isso este layout NÃO lê a sessão nem chama `redirect`: só envolve o
 * conteúdo num container centralizado. Não há dado sensível na tela de login, e
 * proxy.ts (Plan 03) já isenta /admin/entrar da camada de cookie.
 *
 * Não renderiza <html>/<body> — o root layout (app/layout.tsx) já provê.
 */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[60vh]">{children}</div>
}
