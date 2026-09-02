import { Clock, Truck, Inbox, Boxes, Wallet, ClipboardList, MessageCircle } from 'lucide-react'
import { painelDoDia } from '@/lib/admin/painel-dia'
import { BotaoImprimir } from '@/components/admin/botao-imprimir'
import {
  PageHeader,
  SurfaceCard,
  StatTile,
  Chip,
  EmptyState,
  type ChipTone,
} from '@/components/admin/ui'

const diaExtenso = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
})

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADA: 'Confirmada',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
}

const STATUS_TONE: Record<string, ChipTone> = {
  PENDENTE: 'warn',
  CONFIRMADA: 'rosa',
  AGUARDANDO_RETIRADA: 'ok',
}

/**
 * ADM-02/03 — mesma tela serve de painel e de lista de separação impressa
 * (botão chama window.print()). O quadradinho à esquerda de cada pedido é
 * de propósito um desenho, não um checkbox: ela risca no PAPEL enquanto
 * separa — marcar na tela com a mão suja não ia acontecer.
 */
export default async function PainelDoDiaPage() {
  const grupos = await painelDoDia()

  const reservas = grupos.flatMap((g) => g.reservas)
  const entregas = reservas.filter((r) => r.deliveryMode === 'ENTREGA').length
  const unidades = reservas.reduce((s, r) => s + r.itens.reduce((t, i) => t + i.qtde, 0), 0)
  const naoPagas = reservas.filter((r) => !r.pago).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel do dia"
        subtitle={`${diaExtenso.format(new Date())} · ${reservas.length} pedido${reservas.length === 1 ? '' : 's'} · ${unidades} unidade${unidades === 1 ? '' : 's'} pra separar`}
      >
        <BotaoImprimir />
      </PageHeader>

      {reservas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma retirada prevista"
          description="Assim que você confirmar uma reserva, ela entra aqui na janela combinada — e essa mesma tela vira a lista de separação impressa."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
            <StatTile
              label="Pedidos"
              value={reservas.length}
              sub={`em ${grupos.length} janela${grupos.length === 1 ? '' : 's'}`}
              icon={Inbox}
            />
            <StatTile
              label="Entregas"
              value={entregas}
              sub={entregas === 0 ? 'nenhuma pra levar' : 'precisam de endereço na mão'}
              icon={Truck}
            />
            <StatTile label="Unidades" value={unidades} sub="somando todos os pedidos" icon={Boxes} />
            <StatTile
              label="A receber na porta"
              value={naoPagas}
              tone={naoPagas > 0 ? 'danger' : 'default'}
              sub={naoPagas === 0 ? 'está tudo pago' : 'pedidos ainda não pagos'}
              icon={Wallet}
            />
          </div>

          <div className="space-y-6">
            {grupos.map((g) => {
              const unidadesJanela = g.reservas.reduce(
                (t, r) => t + r.itens.reduce((s, i) => s + i.qtde, 0),
                0
              )
              return (
                <section key={g.janela} className="space-y-3 break-inside-avoid">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground">
                      <Clock className="size-4" aria-hidden />
                      {g.janela}
                    </span>
                    <span className="h-px flex-1 bg-border print:hidden" aria-hidden />
                    <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                      {g.reservas.length} pedido{g.reservas.length === 1 ? '' : 's'} · {unidadesJanela} un
                    </span>
                  </div>

                  <SurfaceCard className="print:p-0 print:shadow-none print:ring-0">
                    <ul className="divide-y divide-border">
                      {g.reservas.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0 print:break-inside-avoid"
                        >
                          <span
                            className="mt-0.5 size-[22px] shrink-0 rounded-md border-[1.5px] border-caramelo bg-card"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold">{r.clienteNome}</span>
                              {r.deliveryMode === 'ENTREGA' && (
                                <Chip tone="rosa" icon={Truck}>
                                  Entrega
                                </Chip>
                              )}
                              {!r.pago && <Chip tone="danger">A pagar</Chip>}
                              <span className="print:hidden">
                                <Chip tone={STATUS_TONE[r.status] ?? 'creme'}>
                                  {STATUS_LABEL[r.status] ?? r.status}
                                </Chip>
                              </span>
                            </div>

                            {r.deliveryMode === 'ENTREGA' && r.enderecoEntrega && (
                              <p className="text-[13px] font-medium text-warn">{r.enderecoEntrega}</p>
                            )}

                            <ul className="flex flex-wrap gap-2 pt-0.5">
                              {r.itens.map((item, i) => (
                                <li
                                  key={i}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-background py-1 pl-1.5 pr-2.5 text-[13px] tabular-nums"
                                >
                                  <span className="flex h-5 min-w-[22px] items-center justify-center rounded-md bg-primary px-1 text-xs font-semibold text-primary-foreground">
                                    {item.qtde}
                                  </span>
                                  {item.nome}
                                </li>
                              ))}
                            </ul>

                            {r.observacao && (
                              <p className="flex items-start gap-2 text-[13px] italic text-muted-foreground">
                                <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-caramelo" aria-hidden />
                                {r.observacao}
                              </p>
                            )}
                          </div>

                          {r.clienteTelefone && (
                            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                              {r.clienteTelefone}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </SurfaceCard>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
