import Link from 'next/link'
import { TriangleAlert, Truck, Inbox, Gift, Clock, Wallet, MessageCircle, Ban } from 'lucide-react'
import { listarReservasAdmin, FILTROS_RESERVA, type FiltroReserva } from '@/lib/reservas/queries'
import { dataCivilFmtBR, instanteFmtBR } from '@/lib/format/date'
import { ReservaAcoes } from '@/components/admin/reserva-acoes'
import { STATUS_LABEL } from '@/lib/reservas/labels'
import { nomeItemResgatavel } from '@/lib/resgate/nome'
import {
  PageHeader,
  SegmentedNav,
  SurfaceCard,
  Chip,
  EmptyState,
  type ChipTone,
} from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const FILTRO_LABEL: Record<FiltroReserva, string> = {
  pendentes: 'Pendentes',
  confirmadas: 'Confirmadas',
  historico: 'Histórico',
}

const STATUS_TONE: Record<string, ChipTone> = {
  PENDENTE: 'warn',
  CONFIRMADA: 'rosa',
  AGUARDANDO_RETIRADA: 'rosa',
  RETIRADA: 'ok',
  CANCELADA: 'creme',
  NAO_RETIRADA: 'danger',
}

/** Iniciais no lugar de foto: o painel não tem avatar de cliente e uma bolinha vazia é pior. */
function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** RES-06/07/13/14 — fila de reservas + confirmação. */
export default async function ReservasAdminPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro: filtroParam } = await searchParams
  const filtro: FiltroReserva = FILTROS_RESERVA.includes(filtroParam as FiltroReserva)
    ? (filtroParam as FiltroReserva)
    : 'pendentes'

  const reservas = await listarReservasAdmin(filtro)

  const somaTotal = reservas.reduce(
    (soma, r) =>
      soma +
      r.itens.reduce((s, i) => s + i.qtde * Number(i.precoUnitarioCongelado), 0) +
      (r.taxaEntregaCongelada ? Number(r.taxaEntregaCongelada) : 0),
    0
  )
  const aPagar = reservas.filter((r) => !r.pago && r.status !== 'CANCELADA').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        subtitle={
          reservas.length === 0
            ? 'Nada nesse filtro no momento'
            : `${reservas.length} ${filtro === 'pendentes' ? 'esperando confirmação' : 'nesse filtro'} · ${currency.format(somaTotal)} somados${aPagar > 0 ? ` · ${aPagar} ainda a pagar` : ''}`
        }
      >
        <Link
          href="/admin/reservas/a-receber"
          className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium"
        >
          <Wallet className="size-4 text-caramelo" aria-hidden />A receber
        </Link>
      </PageHeader>

      <SegmentedNav
        items={FILTROS_RESERVA.map((f) => ({
          href: `/admin/reservas?filtro=${f}`,
          label: FILTRO_LABEL[f],
          active: filtro === f,
        }))}
      />

      {reservas.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtro === 'pendentes' ? 'Nenhuma reserva esperando' : 'Nada por aqui'}
          description={
            filtro === 'pendentes'
              ? 'Quando alguém reservar pela vitrine, o pedido cai aqui pra você confirmar — e o menu ao lado mostra o contador.'
              : 'Troque o filtro acima pra ver as reservas de outros estados.'
          }
        />
      ) : (
        <ul className="space-y-4">
          {reservas.map((r) => {
            const total =
              r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0) +
              (r.taxaEntregaCongelada ? Number(r.taxaEntregaCongelada) : 0)
            const nome = r.cliente?.name ?? r.nomeConvidado ?? '—'
            const entrega = r.deliveryMode === 'ENTREGA'

            return (
              <li key={r.id}>
                <SurfaceCard>
                  <div className="space-y-4">
                    {/* Quem — identidade e sinais de risco na mesma linha de olho. */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-semibold">
                          {iniciais(nome)}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
                            {r.cliente ? (
                              <Link
                                href={`/admin/clientes/${r.cliente.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {nome}
                              </Link>
                            ) : (
                              nome
                            )}
                            {!r.cliente && <Chip tone="creme">Convidado</Chip>}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            {r.cliente?.email ?? r.emailConvidado}
                            {(r.cliente?.telefone ?? r.telefoneConvidado)
                              ? ` · ${r.cliente?.telefone ?? r.telefoneConvidado}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.noShowsDoCliente > 0 && (
                          <Chip tone="danger" icon={TriangleAlert}>
                            {r.noShowsDoCliente} não retirada{r.noShowsDoCliente === 1 ? '' : 's'} antes
                          </Chip>
                        )}
                        {r.cliente?.banned && (
                          <Chip tone="creme" icon={Ban}>
                            Bloqueado{r.cliente.banReason ? `: ${r.cliente.banReason}` : ''}
                          </Chip>
                        )}
                        {r.tipo === 'RESGATE' && (
                          <Chip tone="rosa" icon={Gift}>
                            Resgate
                          </Chip>
                        )}
                        <Chip tone={STATUS_TONE[r.status] ?? 'creme'} icon={r.status === 'PENDENTE' ? Clock : undefined}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Chip>
                        {r.status !== 'CANCELADA' && (
                          <Chip tone={r.pago ? 'ok' : 'danger'}>{r.pago ? 'Pago' : 'A pagar'}</Chip>
                        )}
                      </div>
                    </div>

                    {/* O quê + quando — o pedido num bloco só, os detalhes ao lado. */}
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                      <div className="space-y-2 rounded-xl bg-background px-4 py-3.5">
                        {r.tipo === 'RESGATE' ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{nomeItemResgatavel(r.itemResgatavel)}</p>
                            <p className="text-[13px] tabular-nums text-muted-foreground">
                              {r.itemResgatavel?.custoPontos} pontos
                              {r.valorResgateCongelado !== null &&
                                ` · você deixa de faturar ${currency.format(Number(r.valorResgateCongelado))}`}
                            </p>
                          </div>
                        ) : (
                          <ul className="space-y-1.5">
                            {r.itens.map((item, i) => (
                              <li key={i} className="flex items-baseline gap-2.5 tabular-nums">
                                <span className="min-w-7 text-sm font-semibold">{item.qtde}×</span>
                                <span className="flex-1 text-sm">
                                  {item.lote.produto.nome} — {item.lote.variacao.nome}
                                </span>
                                <span className="text-[13px] text-muted-foreground">
                                  lote vence {dataCivilFmtBR.format(item.lote.validade)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          {entrega ? (
                            <Truck className="mt-0.5 size-4 shrink-0 text-caramelo" aria-hidden />
                          ) : (
                            <Inbox className="mt-0.5 size-4 shrink-0 text-caramelo" aria-hidden />
                          )}
                          <div className="space-y-0.5">
                            <p className="text-[13px] font-semibold">{entrega ? 'Entrega' : 'Retirada'}</p>
                            <p className="text-[13px] leading-snug text-muted-foreground">
                              {entrega ? `${r.enderecoEntrega} · ${r.janelaRetirada}` : r.janelaRetirada}
                              {entrega && r.taxaEntregaCongelada !== null && (
                                <span className="tabular-nums">
                                  {' '}
                                  (taxa {currency.format(Number(r.taxaEntregaCongelada))})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {r.observacao && (
                          <div className="flex items-start gap-2.5">
                            <MessageCircle className="mt-0.5 size-4 shrink-0 text-caramelo" aria-hidden />
                            <p className="text-[13px] italic leading-snug text-muted-foreground">
                              {r.observacao}
                            </p>
                          </div>
                        )}

                        {r.cliente && (
                          <div className="flex items-start gap-2.5">
                            <Wallet className="mt-0.5 size-4 shrink-0 text-caramelo" aria-hidden />
                            <p className="text-[13px] leading-snug tabular-nums text-muted-foreground">
                              {r.historicoCliente.totalReservas === 0
                                ? 'Primeira reserva desse cliente'
                                : `${r.historicoCliente.totalReservas} reserva(s) antes · ${currency.format(r.historicoCliente.valorTotal)} no total`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quanto + o que fazer. */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3.5">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-[22px] font-semibold tracking-tight tabular-nums">
                          {r.tipo === 'RESGATE'
                            ? `${r.itemResgatavel?.custoPontos ?? 0} pontos`
                            : currency.format(total)}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          pedida em {instanteFmtBR.format(r.criadoEm)}
                        </span>
                      </div>
                      <ReservaAcoes
                        reservaId={r.id}
                        status={r.status}
                        clienteId={r.cliente?.id ?? null}
                        clienteBloqueado={r.cliente?.banned ?? false}
                        pago={r.pago}
                      />
                    </div>
                  </div>
                </SurfaceCard>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
