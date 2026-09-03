import Link from 'next/link'
import { Gift, Star } from 'lucide-react'
import { listarItensResgataveisAdmin } from '@/lib/resgate/queries'
import { nomeItemResgatavel } from '@/lib/resgate/nome'
import { Button } from '@/components/ui/button'
import { PageHeader, RowCard, Chip, EmptyState } from '@/components/admin/ui'

/** RESG-01/02/07 — catálogo de resgate, admin. */
export default async function ResgatesPage() {
  const itens = await listarItensResgataveisAdmin()
  const ativos = itens.filter((i) => i.ativo).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de resgate"
        subtitle={
          itens.length === 0
            ? 'Nenhum item cadastrado ainda'
            : `${itens.length} item${itens.length === 1 ? '' : 'ns'} · ${ativos} visíve${ativos === 1 ? 'l' : 'is'} pro cliente`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/resgates/novo">Novo item</Link>
        </Button>
      </PageHeader>

      {itens.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Nenhum item ainda"
          description="Cadastre o que o cliente pode trocar por pontos — pode ser um produto do catálogo ou algo escrito à mão, tipo “um docinho surpresa”."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/resgates/novo">Cadastrar o primeiro</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((item) => (
            <li key={item.id}>
              <RowCard>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
                  <Gift className="size-5 text-caramelo" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/resgates/${item.id}/editar`}
                    className="text-[15px] font-semibold underline-offset-2 hover:underline"
                  >
                    {nomeItemResgatavel(item)}
                  </Link>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5">
                  <Star className="size-4 text-caramelo" aria-hidden />
                  <span className="text-[15px] font-semibold tabular-nums">{item.pontos ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">pontos</span>
                </span>
                {!item.ativo && <Chip tone="creme">Escondido da vitrine</Chip>}
                <Button asChild variant="outline" className="h-10 shrink-0">
                  <Link href={`/admin/resgates/${item.id}/editar`}>Editar</Link>
                </Button>
              </RowCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
