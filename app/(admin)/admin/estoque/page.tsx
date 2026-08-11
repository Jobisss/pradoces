import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { snapshotEstoque } from '@/lib/admin/estoque'
import { dataCivilFmtBR } from '@/lib/format/date'

/** ADM-05 — snapshot agregado de estoque por produto. */
export default async function EstoquePage() {
  const estoque = await snapshotEstoque()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Estoque</h1>

      {estoque.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lote com estoque no momento.</p>
      ) : (
        <ul className="divide-y divide-border">
          {estoque.map((e) => (
            <li key={`${e.produtoId}:${e.variacaoId ?? ''}`} className="flex items-center justify-between py-3">
              <div>
                <Link href="/admin/lotes" className="text-base font-medium underline-offset-2 hover:underline">
                  {e.nome}
                </Link>
                {e.vencendoEmBreve && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="size-3.5" aria-hidden />
                    Tem lote vencendo em até 2 dias
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="tabular-nums text-base font-medium">{e.qtdeTotal} un</p>
                {e.proximaValidade && (
                  <p className="tabular-nums text-xs text-muted-foreground">
                    próx. validade {dataCivilFmtBR.format(new Date(e.proximaValidade))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
