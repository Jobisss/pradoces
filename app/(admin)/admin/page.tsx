import Link from 'next/link'

/**
 * Home do painel admin (placeholder Phase 1) — vive SOB o layout guardado do
 * Plan 03 (proxy.ts + role gate DB). O dashboard real (métricas, financeiro)
 * chega na Phase 7; por ora só dá acesso ao viewer de auditoria.
 */
export default function AdminHomePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Painel da administradora</h1>
          <p className="text-base text-muted-foreground">
            O dashboard completo (vendas, lucro por doce, financeiro) chega na Phase 7. Por enquanto,
            você já pode acompanhar o que acontece no sistema.
          </p>
        </header>

        <nav className="space-y-2">
          <Link
            href="/admin/auditoria"
            className="text-primary underline underline-offset-4"
          >
            Auditoria
          </Link>
        </nav>
      </div>
    </div>
  )
}
