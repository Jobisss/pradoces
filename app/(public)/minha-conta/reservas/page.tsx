import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { listarReservasCliente } from '@/lib/reservas/queries'
import { dataCivilFmtBR } from '@/lib/format/date'
import { CancelarReservaBotao } from '@/components/cancelar-reserva-botao'
import { MinhaContaNav } from '@/components/minha-conta-nav'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando confirmação',
  CONFIRMADA: 'Confirmada',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
  RETIRADA: 'Retirada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'Não retirada',
}

export const metadata = { title: 'Minhas reservas — Luizinha Confeitaria' }

/** RES-08/09 — lista de reservas do cliente, com cancelamento (UNDO 30s). */
export default async function MinhasReservasPage() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const reservas = await listarReservasCliente(session!.user.id)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <MinhaContaNav ativo="/minha-conta/reservas" />
      <h1 className="font-display text-3xl font-semibold">Minhas reservas</h1>

      {reservas.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base text-muted-foreground">Você ainda não fez nenhuma reserva.</p>
          <Link href="/" className="text-sm text-primary underline underline-offset-2">
            Ver os doces disponíveis
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {reservas.map((r) => {
            const total = r.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0)
            const cancelavel = r.status === 'PENDENTE' || r.status === 'CONFIRMADA'
            return (
              <li key={r.id} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <Link href={`/r/${r.token}`} className="text-sm text-primary underline underline-offset-2">
                    Ver comprovante
                  </Link>
                </div>
                {r.tipo === 'RESGATE' ? (
                  <p className="text-sm">
                    Resgate: {r.itemResgatavel?.produto?.nome ?? r.itemResgatavel?.nomeCustom}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {r.itens.map((item, i) => (
                      <li key={i} className="tabular-nums">
                        {item.qtde}× {item.lote.produto.nome} (lote vence {dataCivilFmtBR.format(item.lote.validade)})
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted-foreground">Retirada: {r.janelaRetirada}</p>
                {r.tipo === 'RESGATE' ? (
                  <p className="tabular-nums text-sm font-medium">{r.itemResgatavel?.custoPontos} pontos</p>
                ) : (
                  <p className="tabular-nums text-sm font-medium">{currency.format(total)}</p>
                )}
                {cancelavel && <CancelarReservaBotao reservaId={r.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
