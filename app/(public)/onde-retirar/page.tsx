import { MapPinIcon } from 'lucide-react'
import { enderecoRetirada } from '@/lib/contato'
import { WhatsappButton } from '@/components/whatsapp-button'

export const metadata = { title: 'Onde retirar — Luizinha Confeitaria' }

/** CAT-07 — endereço + Maps + observação. v1 é só retirada (PROJECT.md). */
export default function OndeRetirarPage() {
  const endereco = enderecoRetirada()

  return (
    <section className="mx-auto max-w-xl space-y-6 px-4 py-8 md:px-8">
      <h1 className="font-display text-3xl font-semibold">Onde retirar</h1>

      {endereco ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="flex items-start gap-2 text-base">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span>{endereco.texto}</span>
          </p>
          {endereco.observacao && <p className="text-sm text-muted-foreground">{endereco.observacao}</p>}
          {endereco.mapsUrl && (
            <a
              href={endereco.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium"
            >
              Ver no Google Maps
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          O endereço de retirada ainda não foi cadastrado — combina direto com a Luizinha pelo WhatsApp.
        </p>
      )}

      <p className="text-base text-muted-foreground">
        A retirada é sempre combinada com antecedência. Depois de reservar, a Luizinha confirma o
        horário certinho com você.
      </p>

      <WhatsappButton className="h-12 w-full text-base sm:w-auto" />
    </section>
  )
}
