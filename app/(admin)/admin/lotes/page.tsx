import Link from 'next/link'
import { TriangleAlert, PackageOpen, CalendarDays, Layers, ChefHat } from 'lucide-react'
import { listarLotes, type FiltroLote } from '@/lib/lotes/queries'
import { Button } from '@/components/ui/button'
import { LoteBaixaAcao } from '@/components/admin/lote-baixa-acao'
import { LoteVendaAcao } from '@/components/admin/lote-venda-acao'
import { listarClientesParaSelecao } from '@/lib/clientes/queries'
import { dataCivilFmtBR, instanteFmtBR } from '@/lib/format/date'
import { PageHeader, SegmentedNav, RowCard, ColHead, Chip, EmptyState } from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const FILTROS: Array<{ value: FiltroLote; label: string }> = [
  { value: 'vigentes', label: 'Vigentes' },
  { value: 'vencidos', label: 'Vencidos' },
  { value: 'esgotados', label: 'Esgotados' },
]

/** Legenda da barra — as três cores só significam algo se estiverem nomeadas. */
function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-sm bg-warn" aria-hidden />
        saiu
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-sm bg-caramelo" aria-hidden />
        reservado
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-sm bg-muted" aria-hidden />
        livre
      </span>
    </div>
  )
}

export default async function LotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro: filtroParam } = await searchParams
  const filtro: FiltroLote =
    filtroParam === 'vencidos' || filtroParam === 'esgotados' ? filtroParam : 'vigentes'

  // Um findMany só pra alimentar TODOS os seletores de venda da página — a
  // alternativa seria uma query por lote renderizado.
  const [lotes, clientes] = await Promise.all([listarLotes(filtro), listarClientesParaSelecao()])

  const livresTotal = lotes.reduce((s, l) => s + Math.max(0, l.qtdeDisponivel - l.qtdeReservada), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes produzidos"
        subtitle={
          lotes.length === 0
            ? 'Nada nesse filtro'
            : `${lotes.length} lote${lotes.length === 1 ? '' : 's'} ${filtro} · ${livresTotal} unidade${livresTotal === 1 ? '' : 's'} ainda livres`
        }
      >
        <Button asChild className="h-11 gap-2 px-5 text-base">
          <Link href="/admin/lotes/produzir">
            <ChefHat className="size-4" aria-hidden />
            Produzi hoje
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedNav
          items={FILTROS.map((f) => ({
            href: `/admin/lotes?filtro=${f.value}`,
            label: f.label,
            active: filtro === f.value,
          }))}
        />
        {lotes.length > 0 && <Legenda />}
      </div>

      {lotes.length === 0 ? (
        filtro === 'vigentes' ? (
          <EmptyState
            icon={Layers}
            title="Nenhum lote na ativa"
            description="Lote é uma fornada: quantas saíram, quando vencem e quanto custou cada unidade. Sem lote não tem o que reservar na vitrine."
          >
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/admin/lotes/produzir">Registrar um lote</Link>
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={Layers}
            title="Nada por aqui"
            description="Troque o filtro acima pra ver os lotes vigentes."
          />
        )
      ) : (
        <div className="space-y-2.5">
          <ColHead
            cols={[
              { label: 'Lote', className: 'w-[290px]' },
              { label: 'Validade', className: 'w-[140px]' },
              { label: 'Quanto ainda dá pra vender', className: 'flex-1' },
              { label: 'Custo', className: 'w-[110px] text-right' },
            ]}
          />

          <ul className="space-y-2.5">
            {lotes.map((lote) => {
              const livre = Math.max(0, lote.qtdeDisponivel - lote.qtdeReservada)
              const produzido = lote.rendimentoReal || lote.qtdeDisponivel || 1
              const saiu = Math.max(0, produzido - lote.qtdeDisponivel)
              const totalBaixado = lote.baixas?.reduce((s, b) => s + b.qtde, 0) ?? 0
              const pct = (n: number) => `${Math.min(100, (n / produzido) * 100)}%`

              return (
                <li key={lote.id}>
                  <RowCard>
                    <div className="min-w-0 space-y-1 md:w-[290px]">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold">
                          {lote.produto.nome}
                          {lote.variacao ? ` — ${lote.variacao.nome}` : ''}
                        </span>
                        {filtro === 'vencidos' && (
                          <Chip tone="danger" icon={TriangleAlert}>
                            Vencido
                          </Chip>
                        )}
                        {lote.qtdeDisponivel === 0 && (
                          <Chip tone="creme" icon={PackageOpen}>
                            Esgotado
                          </Chip>
                        )}
                      </p>
                      <p className="text-[13px] tabular-nums text-muted-foreground">
                        produzido {instanteFmtBR.format(lote.produzidoEm)} · {produzido} unidades
                      </p>
                    </div>

                    <div className="w-[140px] shrink-0">
                      <p className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                        <CalendarDays className="size-3.5 text-caramelo" aria-hidden />
                        {dataCivilFmtBR.format(lote.validade)}
                      </p>
                      <p className="text-xs text-muted-foreground">validade</p>
                    </div>

                    <div className="min-w-[220px] flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] tabular-nums">
                        <span className="font-semibold">{livre} livres</span>
                        <span className="text-muted-foreground">
                          {saiu} saíram · {lote.qtdeReservada} reservados
                          {totalBaixado > 0 &&
                            ` · ${totalBaixado} baixado${totalBaixado === 1 ? '' : 's'} (${currency.format(lote.custoPorUnidadeCongelado.times(totalBaixado).toNumber())} perdidos)`}
                        </span>
                      </div>
                      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-2 rounded-l-full bg-warn" style={{ width: pct(saiu) }} />
                        <div className="h-2 bg-caramelo" style={{ width: pct(lote.qtdeReservada) }} />
                      </div>
                    </div>

                    <div className="w-[110px] shrink-0 md:text-right">
                      <p className="text-[15px] font-semibold tabular-nums">
                        {currency.format(lote.custoPorUnidadeCongelado.toNumber())}
                      </p>
                      <p className="text-xs text-muted-foreground">por unidade</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <LoteVendaAcao loteId={lote.id} livre={livre} clientes={clientes} />
                      <LoteBaixaAcao loteId={lote.id} livre={livre} />
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
