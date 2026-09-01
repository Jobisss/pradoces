import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { listarReservasAdmin, FILTROS_RESERVA, type FiltroReserva } from '@/lib/reservas/queries'
import { dataCivilFmtBR, instanteFmtBR } from '@/lib/format/date'
import { ReservaAcoes } from '@/components/admin/reserva-acoes'
import { STATUS_LABEL } from '@/lib/reservas/labels'
import { nomeItemResgatavel } from '@/lib/resgate/nome'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const FILTRO_LABEL: Record<FiltroReserva, string> = {
  pendentes: 'Pendentes',
  confirmadas: 'Confirmadas',
  historico: 'Histórico',
}

/** RES-06/07/13/14 — fila de reservas + confirmação. */
export default async function ReservasAdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro: filtroParam } = await searchParams
  const filtro: FiltroReserva = FILTROS_RESERVA.includes(filtroParam as FiltroReserva)
    ? (filtroParam as FiltroReserva)
    : 'pendentes'

  const reservas = await listarReservasAdmin(filtro)

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Reservas</h1>

      <nav className="flex flex-wrap gap-2">
        {FILTROS_RESERVA.map((f) => (
          <Link
            key={f}
            href={`/admin/reservas?filtro=${f}`}
            className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
              filtro === f ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
            }`}
          >
            {FILTRO_LABEL[f]}
          </Link>
        ))}
        {/* Rota própria (não um filtro): agrupa por devedor em vez de listar reserva a reserva. */}
        <Link
          href="/admin/reservas/a-receber"
          className="flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground"
        >
          A receber
        </Link>
      </nav>

      {reservas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filtro === 'pendentes' ? 'Nenhuma reserva esperando confirmação.' : 'Nada por aqui.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {reservas.map((r) => {
            const total =
              r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0) +
              (r.taxaEntregaCongelada ? Number(r.taxaEntregaCongelada) : 0)
            return (
              <li key={r.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-base font-medium">
                      {r.cliente ? (
                        <Link href={`/admin/clientes/${r.cliente.id}`} className="underline-offset-2 hover:underline">
                          {r.cliente.name}
                        </Link>
                      ) : (
                        (r.nomeConvidado ?? '—')
                      )}
                      {!r.cliente && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          Convidado
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.cliente?.email ?? r.emailConvidado}
                      {(r.cliente?.telefone ?? r.telefoneConvidado) ? ` · ${r.cliente?.telefone ?? r.telefoneConvidado}` : ''}
                    </p>
                    {r.cliente && (
                      <p className="text-sm text-muted-foreground">
                        {r.historicoCliente.totalReservas === 0
                          ? 'Primeira reserva desse cliente'
                          : `${r.historicoCliente.totalReservas} reserva(s) anterior(es) · ${currency.format(r.historicoCliente.valorTotal)} no total`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.noShowsDoCliente > 0 && (
                      <span className="flex items-center gap-1 rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive">
                        <TriangleAlert className="size-3" aria-hidden />
                        {r.noShowsDoCliente} não retirada(s) antes
                      </span>
                    )}
                    {r.cliente?.banned && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Bloqueado{r.cliente.banReason ? `: ${r.cliente.banReason}` : ''}
                      </span>
                    )}
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {r.status !== 'CANCELADA' && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.pago
                            ? 'bg-primary/20 text-foreground'
                            : 'border border-destructive text-destructive'
                        }`}
                      >
                        {r.pago ? 'Pago' : 'A pagar'}
                      </span>
                    )}
                  </div>
                </div>

                {r.tipo === 'RESGATE' ? (
                  <p className="text-sm">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">Resgate</span>{' '}
                    {nomeItemResgatavel(r.itemResgatavel)} —{' '}
                    <span className="tabular-nums">{r.itemResgatavel?.custoPontos} pontos</span>
                    {r.valorResgateCongelado !== null && (
                      <span className="tabular-nums text-muted-foreground">
                        {' '}
                        · você deixa de ganhar {currency.format(Number(r.valorResgateCongelado))}
                      </span>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {r.itens.map((item, i) => (
                      <li key={i} className="tabular-nums">
                        {item.qtde}× {item.lote.produto.nome} — {item.lote.variacao.nome} (lote vence{' '}
                        {dataCivilFmtBR.format(item.lote.validade)})
                      </li>
                    ))}
                  </ul>
                )}

                {r.deliveryMode === 'ENTREGA' ? (
                  <p className="text-sm">
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium">Entrega</span>{' '}
                    <span className="font-medium">Endereço: </span>
                    {r.enderecoEntrega}
                    {r.taxaEntregaCongelada !== null && (
                      <span className="tabular-nums text-muted-foreground">
                        {' '}
                        (taxa {currency.format(Number(r.taxaEntregaCongelada))})
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">Retirada: </span>
                    {r.janelaRetirada}
                  </p>
                )}
                {r.deliveryMode === 'ENTREGA' && (
                  <p className="text-sm">
                    <span className="font-medium">Quando: </span>
                    {r.janelaRetirada}
                  </p>
                )}
                {r.observacao && (
                  <p className="text-sm">
                    <span className="font-medium">Observação: </span>
                    {r.observacao}
                  </p>
                )}
                {r.tipo !== 'RESGATE' && (
                  <p className="tabular-nums text-sm text-muted-foreground">
                    Total {currency.format(total)} · pedida em {instanteFmtBR.format(r.criadoEm)}
                  </p>
                )}

                <ReservaAcoes
                  reservaId={r.id}
                  status={r.status}
                  clienteId={r.cliente?.id ?? null}
                  clienteBloqueado={r.cliente?.banned ?? false}
                  pago={r.pago}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
