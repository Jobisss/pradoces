import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { CarrinhoClient } from '@/components/carrinho-client'

export const metadata = { title: 'Carrinho — Luizinha Confeitaria' }

/** RES-01..03 — revisão do carrinho + dados da reserva. */
export default async function CarrinhoPage() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })

  return (
    <section className="mx-auto max-w-xl px-4 py-6 md:px-8">
      <h1 className="mb-4 font-display text-2xl font-semibold md:text-3xl">Seu carrinho</h1>
      <CarrinhoClient logado={!!session} />
    </section>
  )
}
