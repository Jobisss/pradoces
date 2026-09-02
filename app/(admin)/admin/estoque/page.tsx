import Link from 'next/link'
import Decimal from 'decimal.js'
import { TriangleAlert, Boxes, CalendarDays, Wallet, ChefHat } from 'lucide-react'
import { snapshotEstoque } from '@/lib/admin/estoque'
import { dataCivilFmtBR } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionHeading, SurfaceCard, StatTile, Chip, EmptyState } from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ADM-05 — snapshot agregado de estoque por variação. O número que importa
 * não é "quantas tem", é "quantas ainda dá pra VENDER": por isso a barra
 * separa reservado de livre, e o custo parado aparece por item — é o
 * dinheiro que vira prejuízo se o lote vencer.
 */
export default async function EstoquePage() {
  const estoque = await snapshotEstoque()

  const unidades = estoque.reduce((s, e) => s + e.qtdeTotal, 0)
  const reservadas = estoque.reduce((s, e) => s + e.qtdeReservada, 0)
  const vencendo = estoque.reduce((s, e) => s + e.qtdeVencendo, 0)
  const custoParado = estoque.reduce((s, e) => s.plus(e.custoParado), new Decimal(0))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        subtitle={
          estoque.length === 0
            ? 'Nenhum lote com estoque no momento'
            : `${estoque.length} item${estoque.length === 1 ? '' : 'ns'} com lote na ativa · ${unidades} unidade${unidades === 1 ? '' : 's'} prontas`
        }
      >
        <Button asChild className="h-11 gap-2 px-5 text-base">
          <Link href="/admin/lotes/produzir">
            <ChefHat className="size-4" aria-hidden />
            Produzi hoje
          </Link>
        </Button>
      </PageHeader>

      {estoque.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum lote com estoque"
          description="Estoque é a soma dos lotes vigentes por sabor. Registre uma produção e o que sobrou aparece aqui."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/lotes/produzir">Registrar um lote</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Unidades prontas"
              value={unidades}
              sub={`${reservadas} já reservadas · ${unidades - reservadas} livres`}
              icon={Boxes}
            />
            <StatTile
              label="Vencendo em 2 dias"
              value={vencendo}
              tone={vencendo > 0 ? 'danger' : 'default'}
              sub={vencendo === 0 ? 'nada com prazo curto' : 'precisam sair primeiro'}
              icon={TriangleAlert}
            />
            <StatTile
              label="Custo parado"
              value={currency.format(custoParado.toNumber())}
              sub="em lote ainda não vendido"
              icon={Wallet}
            />
            <StatTile
              label="Itens com lote"
              value={estoque.length}
              sub="sabores diferentes na prateleira"
              icon={CalendarDays}
            />
          </div>

          <section className="space-y-3">
            <SectionHeading title="Por sabor">
              <Link
                href="/admin/lotes"
                className="text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Ver lote a lote
              </Link>
            </SectionHeading>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {estoque.map((e) => {
                const livre = Math.max(0, e.qtdeTotal - e.qtdeReservada)
                const pctReservado = e.qtdeTotal === 0 ? 0 : (e.qtdeReservada / e.qtdeTotal) * 100
                return (
                  <li key={`${e.produtoId}:${e.variacaoId ?? ''}`}>
                    <SurfaceCard className="h-full">
                      <div className="flex h-full flex-col gap-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href="/admin/lotes"
                            className="text-[15px] font-semibold underline-offset-2 hover:underline"
                          >
                            {e.nome}
                          </Link>
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-2xl font-semibold leading-none tracking-tight tabular-nums ${e.vencendoEmBreve ? 'text-destructive' : ''}`}
                            >
                              {e.qtdeTotal}
                            </p>
                            <p className="text-xs text-muted-foreground">unidades</p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                            <span>{e.qtdeReservada} reservadas</span>
                            <span>{livre} livres</span>
                          </div>
                          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                            <div
                              className="h-2 rounded-l-full bg-primary"
                              style={{ width: `${pctReservado}%` }}
                            />
                            <div className="h-2 flex-1 rounded-r-full bg-caramelo" />
                          </div>
                        </div>

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                          {e.vencendoEmBreve ? (
                            <Chip tone="danger" icon={TriangleAlert}>
                              {e.qtdeVencendo} un vencem em até 2 dias
                            </Chip>
                          ) : (
                            e.proximaValidade && (
                              <Chip tone="creme" icon={CalendarDays}>
                                vence {dataCivilFmtBR.format(new Date(e.proximaValidade))}
                              </Chip>
                            )
                          )}
                          <span className="text-[13px] tabular-nums text-muted-foreground">
                            {currency.format(e.custoParado.toNumber())} em custo
                          </span>
                        </div>
                      </div>
                    </SurfaceCard>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
