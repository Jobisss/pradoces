import Link from 'next/link'
import { relatorioFaturamento, historicoMensal, margemPorMarca } from '@/lib/admin/relatorios'
import { prisma } from '@/lib/db/client'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function inicioDoMes(): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return `${hoje.slice(0, 7)}-01`
}

function amanha(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** FIN-01..06 — faturamento por período, top produtos, histórico mensal, análise por marca. */
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

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">Relatórios</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Faturamento por período</h2>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label htmlFor="desde" className="text-sm text-muted-foreground">
              De
            </label>
            <input
              type="date"
              id="desde"
              name="desde"
              defaultValue={desdeStr}
              className="block h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ate" className="text-sm text-muted-foreground">
              Até
            </label>
            <input
              type="date"
              id="ate"
              name="ate"
              defaultValue={ateStr}
              className="block h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <button type="submit" className="h-11 rounded-lg border border-border px-4 text-sm font-medium">
            Filtrar
          </button>
        </form>

        <div className="rounded-lg border border-border p-4">
          <p className="tabular-nums text-base">
            Faturou {currency.format(relatorio.faturamentoTotal.toNumber())} · custou{' '}
            {currency.format(relatorio.custoTotal.toNumber())} · lucro real{' '}
            <span className="font-medium">{currency.format(relatorio.lucroTotal.toNumber())}</span>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Top produtos por receita</h2>
        {relatorio.topPorReceita.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada nesse período.</p>
        ) : (
          <ul className="divide-y divide-border">
            {relatorio.topPorReceita.map((p) => (
              <li key={p.variacaoId ?? p.produtoId} className="flex items-center justify-between py-2 text-sm">
                <Link
                  href={
                    p.variacaoId
                      ? `/admin/relatorios?variacao=${p.variacaoId}`
                      : `/admin/relatorios?produto=${p.produtoId}`
                  }
                  className="underline-offset-2 hover:underline"
                >
                  {p.nome} ({p.qtde} un)
                </Link>
                <span className="tabular-nums">{currency.format(p.receita.toNumber())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Top produtos por margem</h2>
        {relatorio.topPorMargem.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada nesse período.</p>
        ) : (
          <ul className="divide-y divide-border">
            {relatorio.topPorMargem.map((p) => (
              <li key={p.variacaoId ?? p.produtoId} className="flex items-center justify-between py-2 text-sm">
                <span>{p.nome}</span>
                <span className="tabular-nums">{p.margemPercent.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Histórico mensal{' '}
          {variacaoFiltro ? `— ${variacaoFiltro.produto.nome} — ${variacaoFiltro.nome}` : '(todos os produtos)'}
        </h2>
        {(params.produto || params.variacao) && (
          <Link href="/admin/relatorios" className="text-sm text-primary underline underline-offset-2">
            Ver todos os produtos
          </Link>
        )}
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados nos últimos 12 meses.</p>
        ) : (
          <ul className="divide-y divide-border">
            {historico.map((h) => (
              <li key={h.mes} className="flex items-center justify-between py-2 text-sm">
                <span>{h.mes}</span>
                <span className="tabular-nums">
                  {currency.format(h.receita.toNumber())} · lucro {currency.format(h.lucro.toNumber())}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Margem por marca de ingrediente</h2>
        {marcas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há lotes vendidos suficientes pra essa análise.</p>
        ) : (
          <ul className="divide-y divide-border">
            {marcas.map((m, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {m.ingrediente} — {m.marca}{' '}
                  <span className="text-muted-foreground">
                    ({m.lotesUsados} lote{m.lotesUsados === 1 ? '' : 's'}, {m.unidadesVendidas} vendida
                    {m.unidadesVendidas === 1 ? '' : 's'})
                  </span>
                </span>
                <span className="tabular-nums">{currency.format(Number(m.lucroTotal))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
