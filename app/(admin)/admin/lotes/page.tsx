import Link from 'next/link'
import { TriangleAlert, PackageX } from 'lucide-react'
import { listarLotes, type FiltroLote } from '@/lib/lotes/queries'
import { Button } from '@/components/ui/button'
import { dataCivilFmtBR, instanteFmtBR } from '@/lib/format/date'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const FILTROS: Array<{ value: FiltroLote; label: string }> = [
  { value: 'vigentes', label: 'Vigentes' },
  { value: 'vencidos', label: 'Vencidos' },
  { value: 'esgotados', label: 'Esgotados' },
]

export default async function LotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro: filtroParam } = await searchParams
  const filtro: FiltroLote =
    filtroParam === 'vencidos' || filtroParam === 'esgotados' ? filtroParam : 'vigentes'

  const lotes = await listarLotes(filtro)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Lotes produzidos</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/lotes/produzir">Produzi hoje</Link>
        </Button>
      </div>

      <nav className="flex gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/lotes?filtro=${f.value}`}
            className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
              filtro === f.value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-foreground'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {lotes.length === 0 ? (
        filtro === 'vigentes' ? (
          <div className="space-y-1">
            <p className="text-base font-medium">Nenhum lote na ativa</p>
            <p className="text-sm text-muted-foreground">
              Quando você produzir, toca em &ldquo;Produzi hoje&rdquo; na tela inicial.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nada por aqui.</p>
        )
      ) : (
        <ul className="divide-y divide-border">
          {lotes.map((lote) => (
            <li key={lote.id} className="space-y-1 py-3">
              <p className="tabular-nums text-base">
                {lote.produto.nome} — lote de {instanteFmtBR.format(lote.produzidoEm)} · vence{' '}
                {dataCivilFmtBR.format(lote.validade)} · {lote.qtdeDisponivel} disponíveis
              </p>
              <div className="flex items-center gap-3">
                <p className="tabular-nums text-sm text-muted-foreground">
                  custou {currency.format(lote.custoPorUnidadeCongelado.toNumber())}/un
                </p>
                {filtro === 'vencidos' && (
                  <span className="flex items-center gap-1 rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive">
                    <TriangleAlert className="size-3" aria-hidden />
                    Vencido
                  </span>
                )}
                {lote.qtdeDisponivel === 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <PackageX className="size-3" aria-hidden />
                    Esgotado
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
