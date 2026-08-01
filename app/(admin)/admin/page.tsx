import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { margensCorrentesBatch } from '@/lib/custo/corrente'

/**
 * Home do painel admin (Phase 2 — substitui o placeholder da Phase 1). Os 2
 * atalhos 1-toque ficam SEMPRE acima da lista "Precisa de atenção" (mãe
 * opera com uma mão, no mercado ou com luva de cozinha). O alerta de margem
 * é computado ON-READ a partir de margensCorrentesBatch — sem tabela nova,
 * sem fila de background (discretion do CONTEXT; embrião do ADM-01 da Phase 7).
 */
export default async function AdminHomePage() {
  const margens = await margensCorrentesBatch()
  const precisamAtencao = margens.filter((m) => m.margem !== null && m.margem.lessThan(m.minima))

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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Precisa de atenção</h2>

        {precisamAtencao.length === 0 ? (
          <div className="space-y-1">
            <p className="text-base font-medium">Tudo em dia por aqui 🎉</p>
            <p className="text-sm text-muted-foreground">
              Quando algum doce ficar com margem baixa, a gente te avisa nesta lista.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {precisamAtencao.map((item) => (
              <li key={item.produtoId} className="space-y-1 border-l-4 border-destructive py-3 pl-3">
                <p className="flex items-start gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {item.nome}: a margem caiu pra {item.margem!.toFixed(0)}% — o preço de um
                  ingrediente subiu
                </p>
                <Link
                  href={`/admin/produtos/${item.produtoId}/editar`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  Ver produto
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
