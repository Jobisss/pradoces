import Link from 'next/link'
import { listarAReceber, totalDaReserva, FILTROS_RESERVA } from '@/lib/reservas/queries'
import { STATUS_LABEL } from '@/lib/reservas/labels'
import { instanteFmtBR } from '@/lib/format/date'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const FILTRO_LABEL: Record<string, string> = {
  pendentes: 'Pendentes',
  confirmadas: 'Confirmadas',
  historico: 'Histórico',
}

/** ADM — quanto cada pessoa ainda deve e por quais produtos. */
export default async function AReceberPage() {
  const { totalGeral, grupos } = await listarAReceber()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Reservas</h1>

      <nav className="flex flex-wrap gap-2">
        {FILTROS_RESERVA.map((f) => (
          <Link
            key={f}
            href={`/admin/reservas?filtro=${f}`}
            className="flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground"
          >
            {FILTRO_LABEL[f]}
          </Link>
        ))}
        <span className="flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          A receber
        </span>
      </nav>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém devendo — está tudo pago.</p>
      ) : (
        <>
          <div className="rounded-lg border border-border p-4">
            <p className="tabular-nums text-2xl font-semibold">{currency.format(totalGeral.toNumber())}</p>
            <p className="text-sm text-muted-foreground">
              Falta receber de {grupos.length} {grupos.length === 1 ? 'pessoa' : 'pessoas'}
            </p>
          </div>

          <ul className="space-y-4">
            {grupos.map((g) => (
              <li key={g.chave} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-base font-medium">
                      {g.clienteId ? (
                        <Link href={`/admin/clientes/${g.clienteId}`} className="underline-offset-2 hover:underline">
                          {g.nome}
                        </Link>
                      ) : (
                        g.nome
                      )}
                      {!g.clienteId && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          Convidado
                        </span>
                      )}
                    </p>
                    {g.contato && <p className="text-sm text-muted-foreground">{g.contato}</p>}
                  </div>
                  <p className="tabular-nums text-lg font-semibold">{currency.format(g.total.toNumber())}</p>
                </div>

                {/* O que compõe o valor — sem isso ela não consegue conferir a conta na hora de cobrar. */}
                <ul className="space-y-3">
                  {g.reservas.map((r) => (
                    <li key={r.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm font-medium">
                        {instanteFmtBR.format(r.criadoEm)} · {r.janelaRetirada}{' '}
                        <span className="font-normal text-muted-foreground">({STATUS_LABEL[r.status]})</span>
                      </p>
                      <ul className="space-y-0.5 text-sm">
                        {r.itens.map((item, i) => (
                          <li key={i} className="flex justify-between gap-2 tabular-nums">
                            <span>
                              {item.qtde}× {item.lote.produto.nome}
                              {item.lote.variacao ? ` — ${item.lote.variacao.nome}` : ''}
                            </span>
                            <span className="text-muted-foreground">
                              {currency.format(Number(item.precoUnitarioCongelado) * item.qtde)}
                            </span>
                          </li>
                        ))}
                        {r.taxaEntregaCongelada && (
                          <li className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                            <span>Taxa de entrega</span>
                            <span>{currency.format(Number(r.taxaEntregaCongelada))}</span>
                          </li>
                        )}
                      </ul>
                      <p className="flex justify-between gap-2 tabular-nums text-sm font-medium">
                        <Link href={`/r/${r.token}`} className="text-primary underline underline-offset-2">
                          Ver comprovante
                        </Link>
                        <span>{currency.format(totalDaReserva(r).toNumber())}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">
            Pra dar baixa, abre a reserva em <Link href="/admin/reservas?filtro=confirmadas" className="text-primary underline underline-offset-2">Confirmadas</Link> e clica em &ldquo;Marcar como pago&rdquo;.
          </p>
        </>
      )}
    </div>
  )
}
