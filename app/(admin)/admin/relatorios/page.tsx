import Link from 'next/link'
import Decimal from 'decimal.js'
import { ChartColumn, Wallet, Layers, ShoppingBasket } from 'lucide-react'
import { relatorioFaturamento, historicoMensal, margemPorMarca } from '@/lib/admin/relatorios'
import { prisma } from '@/lib/db/client'
import { PageHeader, SurfaceCard, StatTile, Meter, EmptyState, EyebrowLabel } from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currencyCurto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

function inicioDoMes(): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return `${hoje.slice(0, 7)}-01`
}

function amanha(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** Topo do eixo arredondado pra cima — um eixo que termina em 2.437 não se lê. */
function topoDoEixo(max: number): number {
  if (max <= 0) return 100
  const passo = Math.pow(10, Math.floor(Math.log10(max)) - 1)
  return Math.ceil(max / (passo * 4)) * passo * 4
}

/** "2026-03" → "mar/26" — o eixo x não cabe o mês por extenso 12 vezes. */
function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${ano.slice(2)}`
}

/**
 * FIN-01..06 — faturamento por período, top produtos, histórico mensal, análise por marca.
 *
 * O histórico é uma barra EMPILHADA (custo embaixo, lucro em cima) num eixo
 * só: as duas medidas são reais, e empilhadas a altura total já é o
 * faturamento — três números por mês sem três gráficos. Dois eixos y seriam
 * o erro clássico aqui.
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; ate?: string; produto?: string; variacao?: string }>
}) {
  const params = await searchParams
  const desdeStr = params.desde || inicioDoMes()
  const ateStr = params.ate || amanha()
  const desde = new Date(`${desdeStr}T00:00:00Z`)
  const ate = new Date(`${ateStr}T00:00:00Z`)

  const [relatorio, historico, marcas, variacaoFiltro] = await Promise.all([
    relatorioFaturamento(desde, ate),
    historicoMensal(12, params.produto, params.variacao),
    margemPorMarca(),
    params.variacao
      ? prisma.variacao.findUnique({
          where: { id: params.variacao },
          select: { nome: true, produto: { select: { nome: true } } },
        })
      : null,
  ])

  const margemPeriodo = relatorio.faturamentoTotal.isZero()
    ? null
    : relatorio.lucroTotal.dividedBy(relatorio.faturamentoTotal).times(100)

  const ALTURA = 208
  const topo = topoDoEixo(
    historico.reduce((m, h) => Math.max(m, h.receita.toNumber()), 0)
  )
  const linhas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo)

  const receitaMax = relatorio.topPorReceita.reduce(
    (m, p) => Decimal.max(m, p.receita),
    new Decimal(0)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle={`Período de ${desdeStr.split('-').reverse().join('/')} a ${ateStr.split('-').reverse().join('/')}`}
      >
        <form className="flex flex-wrap items-end gap-2" method="get">
          <div className="space-y-1">
            <label htmlFor="desde" className="text-xs text-muted-foreground">
              De
            </label>
            <input
              type="date"
              id="desde"
              name="desde"
              defaultValue={desdeStr}
              className="block h-11 rounded-lg border border-input bg-card px-3 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ate" className="text-xs text-muted-foreground">
              Até
            </label>
            <input
              type="date"
              id="ate"
              name="ate"
              defaultValue={ateStr}
              className="block h-11 rounded-lg border border-input bg-card px-3 text-sm tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Aplicar
          </button>
        </form>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Faturamento"
          value={currency.format(relatorio.faturamentoTotal.toNumber())}
          sub="reservas confirmadas no período"
          icon={Wallet}
        />
        <StatTile
          label="Custo"
          value={currency.format(relatorio.custoTotal.toNumber())}
          sub="custo congelado dos lotes vendidos"
          icon={Layers}
        />
        <StatTile
          label="Lucro real"
          value={currency.format(relatorio.lucroTotal.toNumber())}
          tone={relatorio.lucroTotal.isNegative() ? 'danger' : 'ok'}
          sub="faturamento menos custo"
          icon={ChartColumn}
        />
        <StatTile
          label="Margem do período"
          value={margemPeriodo ? `${margemPeriodo.toFixed(1)}%` : '—'}
          tone={margemPeriodo && margemPeriodo.isNegative() ? 'danger' : 'ok'}
          sub={margemPeriodo ? 'do que entrou, sobrou isso' : 'nenhuma venda no período'}
          icon={ChartColumn}
        >
          {margemPeriodo && (
            <Meter
              value={margemPeriodo.toNumber()}
              tone={margemPeriodo.isNegative() ? 'danger' : 'ok'}
            />
          )}
        </StatTile>
      </div>

      {/* -------------------------------------------------- histórico mensal */}
      <SurfaceCard>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold">
                Faturamento e custo, mês a mês
                {variacaoFiltro && ` — ${variacaoFiltro.produto.nome} — ${variacaoFiltro.nome}`}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Últimos 12 meses · as duas faixas empilhadas somam o faturamento
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
                Lucro
              </span>
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className="size-2.5 rounded-sm bg-chart-2" aria-hidden />
                Custo
              </span>
              {(params.produto || params.variacao) && (
                <Link
                  href="/admin/relatorios"
                  className="text-[13px] font-medium underline underline-offset-2"
                >
                  Ver todos os produtos
                </Link>
              )}
            </div>
          </div>

          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem dados nos últimos 12 meses.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto pl-[62px]">
                <div className="relative min-w-[560px]" style={{ height: ALTURA }}>
                  {linhas.map((v) => {
                    const y = ALTURA - (v / topo) * ALTURA
                    return (
                      <div key={v}>
                        <div
                          className={`absolute inset-x-0 h-px ${v === 0 ? 'bg-caramelo' : 'bg-border'}`}
                          style={{ top: y }}
                          aria-hidden
                        />
                        <span
                          className="absolute -left-[62px] w-[54px] text-right text-[11px] tabular-nums text-muted-foreground"
                          style={{ top: y - 8 }}
                        >
                          {v === 0 ? '0' : currencyCurto.format(v)}
                        </span>
                      </div>
                    )
                  })}

                  <div className="absolute inset-0 flex items-end gap-2.5">
                    {historico.map((h) => {
                      const hFat = (h.receita.toNumber() / topo) * ALTURA
                      const hCus = (h.custo.toNumber() / topo) * ALTURA
                      const hLuc = Math.max(0, hFat - hCus - 2)
                      return (
                        <div
                          key={h.mes}
                          className="group/col relative flex flex-1 items-end justify-center"
                          style={{ height: ALTURA }}
                        >
                          <div
                            className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-card px-3 py-2 text-left opacity-0 ring-1 ring-foreground/10 shadow-doce transition-opacity md:block md:group-hover/col:opacity-100"
                            style={{ bottom: Math.min(hFat + 8, ALTURA - 84) }}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                              {rotuloMes(h.mes)}
                            </p>
                            <p className="text-xs tabular-nums">
                              Faturou {currency.format(h.receita.toNumber())}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              Custou {currency.format(h.custo.toNumber())} · sobrou{' '}
                              {currency.format(h.lucro.toNumber())}
                            </p>
                          </div>

                          <div className="flex w-full max-w-[34px] flex-col gap-0.5 rounded-t-sm">
                            <div className="rounded-t-sm bg-chart-1" style={{ height: hLuc }} />
                            <div className="rounded-b-sm bg-chart-2" style={{ height: hCus }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-2 flex min-w-[560px] gap-2.5">
                  {historico.map((h) => (
                    <span
                      key={h.mes}
                      className="flex-1 text-center text-[11px] text-muted-foreground"
                    >
                      {rotuloMes(h.mes)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Relevo pro tom claro da série: os números escritos, não só a cor. */}
              <details className="pt-1">
                <summary className="cursor-pointer text-[13px] text-muted-foreground underline-offset-2 hover:underline">
                  Ver os números do gráfico
                </summary>
                <ul className="mt-2 divide-y divide-border">
                  {historico.map((h) => (
                    <li
                      key={h.mes}
                      className="flex items-center justify-between py-1.5 text-[13px] tabular-nums"
                    >
                      <span>{rotuloMes(h.mes)}</span>
                      <span className="text-muted-foreground">
                        faturou {currency.format(h.receita.toNumber())} · custou{' '}
                        {currency.format(h.custo.toNumber())} · sobrou{' '}
                        {currency.format(h.lucro.toNumber())}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      </SurfaceCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* ------------------------------------------------- top por receita */}
        <SurfaceCard>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold">Quem mais faturou no período</h2>
              <p className="text-[13px] text-muted-foreground">
                Clique num item pra filtrar o histórico só por ele
              </p>
            </div>

            {relatorio.topPorReceita.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nada nesse período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {relatorio.topPorReceita.map((p) => (
                  <li key={p.variacaoId ?? p.produtoId} className="space-y-1.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={
                          p.variacaoId
                            ? `/admin/relatorios?variacao=${p.variacaoId}`
                            : `/admin/relatorios?produto=${p.produtoId}`
                        }
                        className="text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {p.nome}
                        <span className="text-muted-foreground"> · {p.qtde} un</span>
                      </Link>
                      <span className="text-sm font-semibold tabular-nums">
                        {currency.format(p.receita.toNumber())}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-chart-1"
                        style={{
                          width: receitaMax.isZero()
                            ? '0%'
                            : `${p.receita.dividedBy(receitaMax).times(100).toNumber()}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {relatorio.topPorMargem.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <EyebrowLabel>Melhor margem</EyebrowLabel>
                <ul className="divide-y divide-border">
                  {relatorio.topPorMargem.map((p) => (
                    <li
                      key={p.variacaoId ?? p.produtoId}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span>{p.nome}</span>
                      <span className="font-semibold tabular-nums">
                        {p.margemPercent.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SurfaceCard>

        {/* -------------------------------------------------- margem por marca */}
        <SurfaceCard>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold">Impacto por marca de ingrediente</h2>
              <p className="text-[13px] text-muted-foreground">
                Quanto cada marca comprada deixou de lucro nos lotes já vendidos
              </p>
            </div>

            {marcas.length === 0 ? (
              <EmptyState
                icon={ShoppingBasket}
                title="Ainda não dá pra comparar marcas"
                description="Essa análise precisa de lotes já vendidos: assim que as primeiras reservas forem retiradas, o comparativo aparece aqui."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo">
                        Ingrediente
                      </th>
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo">
                        Marca
                      </th>
                      <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo">
                        Vendidas
                      </th>
                      <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo">
                        Lucro
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {marcas.map((m, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-medium">{m.ingrediente}</td>
                        <td className="py-2.5 text-muted-foreground">{m.marca}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                          {m.unidadesVendidas} un
                          <span className="block text-xs">
                            {m.lotesUsados} lote{m.lotesUsados === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          {currency.format(Number(m.lucroTotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}
