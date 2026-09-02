import Link from 'next/link'
import { ShoppingBasket, Package, TriangleAlert } from 'lucide-react'
import { prisma } from '@/lib/db/client'
// dataCompra é @db.Date (dia civil puro) — dataCivilFmtBR lê em UTC, senão a
// data desloca -1 dia. Ver a nota em lib/format/date.ts.
import { dataCivilFmtBR } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { PageHeader, RowCard, ColHead, Chip, EmptyState } from '@/components/admin/ui'

const UNIDADE_LABEL: Record<string, string> = { g: 'gramas', ml: 'mililitros', un: 'unidade' }

const DIAS_SEM_COMPRA = 30

/** Fora do componente de propósito: `Date.now()` no meio do render é impuro. */
function diasDesde(data: Date): number {
  return Math.floor((Date.now() - data.getTime()) / 86_400_000)
}

export default async function IngredientesPage() {
  const ingredientes = await prisma.ingrediente.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { compras: true } },
      compras: { orderBy: { dataCompra: 'desc' }, take: 1, select: { dataCompra: true, marca: true } },
    },
  })

  const semCompra = ingredientes.filter((i) => i._count.compras === 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredientes e embalagens"
        subtitle={
          ingredientes.length === 0
            ? 'Nada cadastrado ainda'
            : `${ingredientes.length} cadastrado${ingredientes.length === 1 ? '' : 's'}${semCompra > 0 ? ` · ${semCompra} ainda sem nenhuma compra` : ''}`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/ingredientes/novo">Novo ingrediente</Link>
        </Button>
      </PageHeader>

      {ingredientes.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Nenhum ingrediente ainda"
          description="Cadastre o primeiro — nome e unidade (g, ml ou unidade) bastam. Forminha e caixa também entram aqui, como embalagem."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/ingredientes/novo">Cadastrar o primeiro</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          <ColHead
            cols={[
              { label: 'Ingrediente', className: 'w-[320px]' },
              { label: 'Compras', className: 'w-[130px]' },
              { label: 'Última compra', className: 'flex-1' },
            ]}
          />

          <ul className="space-y-2.5">
            {ingredientes.map((ing) => {
              const ultima = ing.compras[0]
              const dias = ultima ? diasDesde(ultima.dataCompra) : null
              const velho = dias !== null && dias > DIAS_SEM_COMPRA
              const embalagem = ing.tipo === 'EMBALAGEM'

              return (
                <li key={ing.id}>
                  <RowCard>
                    <div className="flex min-w-0 items-center gap-3.5 md:w-[320px]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
                        {embalagem ? (
                          <Package className="size-5 text-caramelo" aria-hidden />
                        ) : (
                          <ShoppingBasket className="size-5 text-caramelo" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/ingredientes/${ing.id}`}
                            className="text-[15px] font-semibold underline-offset-2 hover:underline"
                          >
                            {ing.nome}
                          </Link>
                          {embalagem && <Chip tone="creme">Embalagem</Chip>}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          medido em {UNIDADE_LABEL[ing.unidadeBase] ?? ing.unidadeBase}
                        </p>
                      </div>
                    </div>

                    <div className="w-[130px] shrink-0">
                      <p className="text-sm tabular-nums">
                        {ing._count.compras} {ing._count.compras === 1 ? 'compra' : 'compras'}
                      </p>
                      {ultima?.marca && (
                        <p className="truncate text-xs text-muted-foreground">{ultima.marca}</p>
                      )}
                    </div>

                    <div className="min-w-[220px] flex-1">
                      {!ultima ? (
                        <span className="inline-flex items-center gap-2 text-[13px] text-warn">
                          <TriangleAlert className="size-3.5" aria-hidden />
                          Sem compra registrada — custo das receitas fica incompleto
                        </span>
                      ) : (
                        <span
                          className={`text-[13px] tabular-nums ${velho ? 'text-warn' : 'text-muted-foreground'}`}
                        >
                          {dataCivilFmtBR.format(ultima.dataCompra)}
                          {dias !== null && ` · há ${dias} dia${dias === 1 ? '' : 's'}`}
                        </span>
                      )}
                    </div>

                    <Button asChild variant="outline" className="h-10 shrink-0">
                      <Link href={`/admin/ingredientes/${ing.id}`}>Abrir</Link>
                    </Button>
                  </RowCard>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
