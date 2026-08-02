import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { saldoPontos, extratoPontos } from '@/lib/pontos/queries'
import { instanteFmtBR } from '@/lib/format/date'
import { MinhaContaNav } from '@/components/minha-conta-nav'

export const metadata = { title: 'Meus pontos — Luizinha Confeitaria' }

/** PT-03/06/07 — saldo derivado, extrato completo, progresso visual. */
export default async function MeusPontosPage() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const clienteId = session!.user.id
  const [saldo, extrato] = await Promise.all([saldoPontos(clienteId), extratoPontos(clienteId)])

  // Sem catálogo de resgate ainda (Phase 5) — marco genérico de 100 em 100 só
  // pra dar uma noção visual de progresso, não é um prêmio real.
  const proximoMarco = saldo <= 0 ? 100 : Math.ceil((saldo + 1) / 100) * 100
  const progresso = Math.min(100, Math.round((saldo / proximoMarco) * 100))

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <MinhaContaNav ativo="/minha-conta/pontos" />
      <h1 className="font-display text-3xl font-semibold">Meus pontos</h1>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="tabular-nums text-3xl font-semibold text-primary">{saldo} pts</p>
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {proximoMarco - saldo} pts até {proximoMarco}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Extrato</h2>
        {extrato.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {extrato.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p>{t.motivoLabel}</p>
                  <p className="text-xs text-muted-foreground">{instanteFmtBR.format(t.criadoEm)}</p>
                </div>
                <span className={`tabular-nums font-medium ${t.valor < 0 ? 'text-destructive' : ''}`}>
                  {t.valor > 0 ? '+' : ''}
                  {t.valor}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
