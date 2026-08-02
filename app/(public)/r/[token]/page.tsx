import { notFound } from 'next/navigation'
import { buscarReservaPorToken } from '@/lib/reservas/queries'
import { dataCivilFmtBR as dateFmt } from '@/lib/format/date'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_COPY: Record<string, string> = {
  PENDENTE: 'Aguardando a Luizinha confirmar',
  CONFIRMADA: 'Confirmada!',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
  RETIRADA: 'Retirada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'Não retirada',
}

/** RES-10 — comprovante público, sem login, protegido só pelo token. */
export default async function ComprovantePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const reserva = await buscarReservaPorToken(token)
  if (!reserva) notFound()

  const total = reserva.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0)

  return (
    <section className="mx-auto max-w-xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <p className="text-sm text-muted-foreground">Comprovante de reserva</p>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">
          {STATUS_COPY[reserva.status] ?? reserva.status}
        </h1>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm">
          <span className="font-medium">Retirada: </span>
          {reserva.janelaRetirada}
        </p>
        {reserva.observacao && (
          <p className="text-sm">
            <span className="font-medium">Observação: </span>
            {reserva.observacao}
          </p>
        )}

        <ul className="divide-y divide-border">
          {reserva.itens.map((item, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.qtde}× {item.lote.produto.nome}{' '}
                <span className="text-muted-foreground">(lote vence {dateFmt.format(item.lote.validade)})</span>
              </span>
              <span className="tabular-nums">{currency.format(item.qtde * Number(item.precoUnitarioCongelado))}</span>
            </li>
          ))}
        </ul>

        <p className="tabular-nums text-right text-base font-medium">Total: {currency.format(total)}</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Guarda esse link — é o seu comprovante. A Luizinha vai confirmar direto com você.
      </p>
    </section>
  )
}
