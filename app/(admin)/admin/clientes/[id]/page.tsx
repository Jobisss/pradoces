import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { buscarClienteAdmin, relatorioCliente } from '@/lib/clientes/queries'
import { ClienteGestao } from '@/components/admin/cliente-gestao'
import { STATUS_LABEL } from '@/lib/reservas/labels'
import { nomeItemResgatavel } from '@/lib/resgate/nome'
import { instanteFmtBR } from '@/lib/format/date'
import { Badge } from '@/components/ui/badge'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Dias corridos entre uma data e agora — pra "sumido há N dias". */
function diasAtras(data: Date): number {
  return Math.floor((Date.now() - data.getTime()) / 86_400_000)
}

function Kpi({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular-nums text-xl font-semibold text-foreground">{valor}</p>
      {hint && <p className="tabular-nums text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Gestão do cliente (pontos/VIP/bloqueio) + relatório completo dele. */
export default async function ClienteAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ desde?: string; ate?: string }>
}) {
  const { id } = await params
  const { desde: desdeStr, ate: ateStr } = await searchParams

  const cliente = await buscarClienteAdmin(id)
  if (!cliente) notFound()

  // Sem período informado = vida inteira do cliente (o padrão que a mãe quer
  // ver ao abrir). `ate` é exclusivo, então soma 1 dia pro dia digitado entrar
  // inteiro. Offset -03:00 fixo: o app inteiro roda em America/Sao_Paulo.
  const desde = desdeStr ? new Date(`${desdeStr}T00:00:00-03:00`) : undefined
  const ate = ateStr ? new Date(`${ateStr}T00:00:00-03:00`) : undefined
  if (ate) ate.setDate(ate.getDate() + 1)
  const rel = await relatorioCliente(cliente.id, cliente.email, desde, ate)

  const totalReserva = (r: (typeof rel.timeline)[number]) =>
    r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0) +
    (r.taxaEntregaCongelada ? Number(r.taxaEntregaCongelada) : 0)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-semibold">
          {cliente.name}
          {cliente.isVip && <Badge>VIP</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cliente.email}
          {cliente.telefone ? ` · ${cliente.telefone}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          Cliente desde {instanteFmtBR.format(cliente.createdAt)}
          {rel.ultimaReserva
            ? ` · última reserva ${instanteFmtBR.format(rel.ultimaReserva)} (${diasAtras(rel.ultimaReserva)} dia(s) atrás)`
            : ' · nunca reservou'}
        </p>
        {cliente.banned && cliente.banReason && (
          <p className="text-sm text-destructive">Bloqueado: {cliente.banReason}</p>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Resumo {desdeStr || ateStr ? 'no período' : '(vida toda)'}</h2>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="desde" className="text-sm text-muted-foreground">
                De
              </label>
              <input
                type="date"
                id="desde"
                name="desde"
                defaultValue={desdeStr ?? ''}
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
                defaultValue={ateStr ?? ''}
                className="block h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <button type="submit" className="h-11 rounded-lg border border-border px-4 text-sm font-medium">
              Filtrar
            </button>
            {(desdeStr || ateStr) && (
              <Link
                href={`/admin/clientes/${cliente.id}`}
                className="flex h-11 items-center text-sm text-primary underline underline-offset-2"
              >
                Ver tudo
              </Link>
            )}
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Gastou"
            valor={currency.format(rel.faturado.totalGasto.toNumber())}
            hint={
              rel.faturado.taxasEntrega.isZero()
                ? undefined
                : `inclui ${currency.format(rel.faturado.taxasEntrega.toNumber())} de entrega`
            }
          />
          <Kpi
            label="Lucro real que deu"
            valor={currency.format(rel.faturado.lucro.toNumber())}
            hint={`custo ${currency.format(rel.faturado.custo.toNumber())} · só produtos, sem entrega`}
          />
          <Kpi
            label="Reservas fechadas"
            valor={String(rel.faturado.nReservas)}
            hint={`ticket médio ${currency.format(rel.faturado.ticketMedio.toNumber())}`}
          />
          <Kpi
            label="Não retiradas"
            valor={String(rel.noShows)}
            hint={rel.canceladas > 0 ? `${rel.canceladas} cancelada(s)` : undefined}
          />
        </div>

        {rel.convidadasNaoVinculadas > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {rel.convidadasNaoVinculadas} reserva(s) feita(s) como convidado com esse mesmo email não estão contadas
            aqui — foram antes do cadastro.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">O que ele mais leva</h2>
        {rel.favoritos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva fechada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rel.favoritos.map((f) => (
              <li key={f.nome} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {f.nome} <span className="tabular-nums text-muted-foreground">({f.qtde} un)</span>
                </span>
                <span className="tabular-nums">{currency.format(f.receita.toNumber())}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pontos</h2>
        <div className="rounded-lg border border-border p-4">
          <p className="tabular-nums text-2xl font-semibold">{cliente.saldoPontos} pontos</p>
          <p className="text-sm text-muted-foreground">Saldo atual (soma de todo o histórico)</p>
          <ul className="mt-3 space-y-1 tabular-nums text-sm text-muted-foreground">
            <li>Ganhou {rel.pontos.ganhos} em reservas e sorteios</li>
            <li>
              Gastou {Math.abs(rel.pontos.gastos)} em {rel.pontos.nResgates} resgate(s)
              {!rel.pontos.valorResgatado.isZero() && (
                <> — você deixou de faturar {currency.format(rel.pontos.valorResgatado.toNumber())}</>
              )}
            </li>
            {rel.pontos.ajustes !== 0 && (
              <li>
                Bônus manual seu: {rel.pontos.ajustes > 0 ? '+' : ''}
                {rel.pontos.ajustes}
              </li>
            )}
            {rel.pontos.estornos !== 0 && <li>Estornos (cancelamento/resgate negado): {rel.pontos.estornos}</li>}
            {rel.pontos.expirados !== 0 && <li>Expiraram: {rel.pontos.expirados}</li>}
          </ul>
        </div>
      </section>

      {rel.pendencias.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Ainda não pagou</h2>
          <ul className="divide-y divide-border">
            {rel.pendencias.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {instanteFmtBR.format(r.criadoEm)} · {STATUS_LABEL[r.status]}
                </span>
                <span className="tabular-nums font-medium">{currency.format(totalReserva(r))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de reservas</h2>
        {rel.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva nesse período.</p>
        ) : (
          <ul className="space-y-3">
            {rel.timeline.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {instanteFmtBR.format(r.criadoEm)} · {r.janelaRetirada}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.tipo === 'RESGATE' && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">Resgate</span>
                    )}
                    {r.deliveryMode === 'ENTREGA' && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium">Entrega</span>
                    )}
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.tipo === 'PADRAO' && r.status !== 'CANCELADA' && !r.pago && (
                      <span className="rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive">
                        A pagar
                      </span>
                    )}
                  </div>
                </div>

                {r.tipo === 'RESGATE' ? (
                  <p className="tabular-nums text-sm">
                    {nomeItemResgatavel(r.itemResgatavel)} — {r.itemResgatavel?.custoPontos} pontos
                  </p>
                ) : (
                  <>
                    <ul className="space-y-0.5 text-sm">
                      {r.itens.map((item, i) => (
                        <li key={i} className="tabular-nums">
                          {item.qtde}× {item.lote.produto.nome}
                          {item.lote.variacao ? ` — ${item.lote.variacao.nome}` : ''}
                        </li>
                      ))}
                    </ul>
                    <p className="tabular-nums text-sm text-muted-foreground">
                      Total {currency.format(totalReserva(r))}
                    </p>
                  </>
                )}

                <Link href={`/r/${r.token}`} className="text-sm text-primary underline underline-offset-2">
                  Ver comprovante
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gestão</h2>
        <ClienteGestao
          clienteId={cliente.id}
          isVip={cliente.isVip}
          bloqueado={cliente.banned}
          saldoBonusAdmin={cliente.saldoBonusAdmin}
        />

        {cliente.ajustesAdmin.length > 0 && (
          <div className="space-y-2">
            <p className="text-base font-medium">Ajustes manuais que você já fez</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {cliente.ajustesAdmin.map((a) => (
                <li key={a.id} className="tabular-nums">
                  {a.valor > 0 ? '+' : ''}
                  {a.valor} pontos — {instanteFmtBR.format(a.criadoEm)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
