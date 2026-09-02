import Link from 'next/link'
import { MapPinIcon } from 'lucide-react'
import { enderecoRetirada } from '@/lib/contato'

/**
 * Onde retirar, versão curta (CAT-07).
 *
 * "Dá pra buscar perto de mim?" é objeção de compra: quem não sabe onde retira
 * não reserva. Mas a resposta completa (mapa, horários, observações) só importa
 * DEPOIS de decidir — por isso aqui vai uma linha e um link pra `/onde-retirar`,
 * que já existe inteira, em vez de duplicar a página na home.
 *
 * Some por completo quando `ENDERECO_RETIRADA` não está configurado: prometer
 * retirada sem dizer onde é pior do que não falar nada — e nesse caso o texto
 * genérico já está na página dedicada, linkada pelo footer.
 */
export function OndeRetirar() {
  const endereco = enderecoRetirada()
  if (!endereco) return null

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12 md:px-8 md:pb-16">
      <div className="flex flex-col gap-3.5 rounded-xl bg-card p-4 shadow-doce-baixa sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
          <MapPinIcon className="size-5.5 text-foreground" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold text-foreground">{endereco.texto}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {endereco.observacao ?? 'O horário é sempre combinado antes — ninguém vai à toa.'}
          </p>
        </div>

        <Link
          href="/onde-retirar"
          className="flex h-11 shrink-0 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Ver como chegar
        </Link>
      </div>
    </section>
  )
}
