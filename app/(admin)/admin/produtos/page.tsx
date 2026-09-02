import Link from 'next/link'
import { TriangleAlert, CakeSlice, Gift } from 'lucide-react'
import { margensCorrentesBatch } from '@/lib/custo/corrente'
import { Button } from '@/components/ui/button'
import {
  PageHeader,
  RowCard,
  ColHead,
  Meter,
  Chip,
  EmptyState,
} from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * FIN/PROD — catálogo com a margem CORRENTE de cada item. A margem sozinha
 * ("62%") não diz nada: o que importa é onde ela cai em relação à mínima
 * configurada do produto, então a barra carrega o traço da mínima.
 */
export default async function ProdutosPage() {
  const margens = await margensCorrentesBatch()

  const abaixo = margens.filter((m) => m.margem !== null && m.margem.lessThan(m.minima)).length
  const semCusto = margens.filter((m) => m.custo === null).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle={
          margens.length === 0
            ? 'Nenhum produto cadastrado ainda'
            : `${margens.length} no catálogo${abaixo > 0 ? ` · ${abaixo} com margem abaixo do mínimo` : ''}${semCusto > 0 ? ` · ${semCusto} sem custo completo` : ''}`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/produtos/novo">Novo produto</Link>
        </Button>
      </PageHeader>

      {margens.length === 0 ? (
        <EmptyState
          icon={CakeSlice}
          title="Nenhum produto ainda"
          description="Produto é o que vai pra vitrine: um doce (ligado a uma receita) ou um kit com vários."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/produtos/novo">Criar o primeiro</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          <ColHead
            cols={[
              { label: 'Produto', className: 'w-[300px]' },
              { label: 'Preço', className: 'w-[110px]' },
              { label: 'Custo', className: 'w-[110px]' },
              { label: 'Margem hoje', className: 'flex-1' },
            ]}
          />

          <ul className="space-y-2.5">
            {margens.map((item) => {
              const semCustoItem = item.custo === null || item.margem === null
              const abaixoDoMinimo = !semCustoItem && item.margem!.lessThan(item.minima)
              return (
                <li key={item.variacaoId ?? item.produtoId}>
                  <RowCard>
                    <div className="flex min-w-0 items-center gap-3.5 md:w-[300px]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
                        {item.tipo === 'KIT' ? (
                          <Gift className="size-5 text-caramelo" aria-hidden />
                        ) : (
                          <CakeSlice className="size-5 text-caramelo" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex items-center gap-2">
                          <Link
                            href={`/admin/produtos/${item.produtoId}/editar`}
                            className="text-[15px] font-semibold underline-offset-2 hover:underline"
                          >
                            {item.produtoNome}
                          </Link>
                          {item.tipo === 'KIT' && <Chip tone="creme">Kit</Chip>}
                        </p>
                        {item.variacaoNome && (
                          <p className="text-[13px] text-muted-foreground">{item.variacaoNome}</p>
                        )}
                      </div>
                    </div>

                    <div className="w-[110px] shrink-0">
                      <p className="text-[15px] font-semibold tabular-nums">
                        {currency.format(item.precoVenda.toNumber())}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">preço</p>
                    </div>

                    <div className="w-[110px] shrink-0">
                      <p className="text-[15px] tabular-nums">
                        {semCustoItem ? (
                          <span className="text-caramelo">—</span>
                        ) : (
                          currency.format(item.custo!.toNumber())
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">custo/un</p>
                    </div>

                    <div className="flex min-w-[220px] flex-1 items-center gap-3.5">
                      {semCustoItem ? (
                        <span className="inline-flex items-center gap-2 text-[13px] text-warn">
                          <TriangleAlert className="size-3.5" aria-hidden />
                          Custo incompleto — falta compra de ingrediente
                        </span>
                      ) : (
                        <>
                          <Meter
                            value={item.margem!.toNumber()}
                            min={item.minima.toNumber()}
                            tone={abaixoDoMinimo ? 'danger' : 'ok'}
                            className="max-w-[150px]"
                          />
                          <div className="shrink-0">
                            <p
                              className={`text-[15px] font-semibold tabular-nums ${abaixoDoMinimo ? 'text-destructive' : ''}`}
                            >
                              {item.margem!.toFixed(0)}% de margem
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              mínima {item.minima.toFixed(0)}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {abaixoDoMinimo && (
                        <Chip tone="danger" icon={TriangleAlert}>
                          Abaixo do mínimo
                        </Chip>
                      )}
                      <Button asChild variant="outline" className="h-10">
                        <Link href={`/admin/produtos/${item.produtoId}/editar`}>Editar</Link>
                      </Button>
                    </div>
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
