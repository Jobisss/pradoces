import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { listarPendencias, resumoDoDia } from '@/lib/admin/home'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Home do painel admin (ADM-01/04) — os 2 atalhos 1-toque ficam SEMPRE acima
 * da lista "Precisa de atenção" (mãe opera com uma mão, no mercado ou com
 * luva de cozinha). Tudo computado ON-READ, sem tabela nova nem fila de
 * background — volume de dados ainda pequeno pra justificar cache.
 */
export default async function AdminHomePage() {
  const [pendencias, resumo] = await Promise.all([listarPendencias(), resumoDoDia()])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-semibold">Oi! O que você fez hoje?</h1>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/compras/nova"
          className="flex min-h-24 flex-col justify-center gap-1 rounded-xl bg-primary p-4 text-primary-foreground"
        >
          <span className="text-lg font-semibold">Fui ao mercado</span>
          <span className="text-sm">Registrar as compras</span>
        </Link>
        <Link
          href="/admin/lotes/produzir"
          className="flex min-h-24 flex-col justify-center gap-1 rounded-xl bg-primary p-4 text-primary-foreground"
        >
          <span className="text-lg font-semibold">Produzi hoje</span>
          <span className="text-sm">Registrar um lote</span>
        </Link>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Resumo de hoje</h2>
        <p className="tabular-nums text-sm">
          Faturou {currency.format(resumo.faturamento.toNumber())} · custou{' '}
          {currency.format(resumo.custoTotal.toNumber())} · sobrou{' '}
          <span className="font-medium">{currency.format(resumo.lucro.toNumber())}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {resumo.retiradasPendentes} retirada{resumo.retiradasPendentes === 1 ? '' : 's'} pendente
          {resumo.retiradasPendentes === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Precisa de atenção</h2>

        {pendencias.length === 0 ? (
          <div className="space-y-1">
            <p className="text-base font-medium">Tudo em dia por aqui 🎉</p>
            <p className="text-sm text-muted-foreground">
              Reserva nova, lote vencendo, ingrediente sumindo do mercado ou margem caindo — a gente
              te avisa aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pendencias.map((p, i) => (
              <li key={i} className="space-y-1 border-l-4 border-destructive py-3 pl-3">
                <p className="flex items-start gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {p.texto}
                </p>
                <Link href={p.href} className="text-sm font-medium underline underline-offset-2">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
