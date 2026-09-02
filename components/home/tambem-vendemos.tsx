import Link from 'next/link'
import Image from 'next/image'
import type { ProdutoCard } from '@/lib/catalogo/produtos'
import { IconeCupcake } from '@/components/home/motivos'

/**
 * Esgotados (CAT-04) — LISTA compacta, não grid de card.
 *
 * A seção tem valor real: mostra pro visitante que nunca comprou o repertório
 * da Luizinha além do pouco que sobrou hoje. Matar seria perder isso.
 *
 * Mas dar a ela o mesmo peso visual do estoque vendável gastava a melhor área da
 * página com o que não gera reserva — e com card grande em 3 colunas isso vira
 * uma parede de cinza no pé. Foto pequena, nome, e nada de preço: preço de
 * coisa que não dá pra reservar é ruído.
 */
export function TambemVendemos({ produtos }: { produtos: ProdutoCard[] }) {
  if (produtos.length === 0) return null

  return (
    <section className="mx-auto max-w-5xl px-4 pb-14 md:px-8 md:pb-16">
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
        Também vendemos
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
        Esgotado por agora — a Luizinha faz sob encomenda, é só chamar.
      </p>

      <ul className="mt-4 grid gap-x-6 md:grid-cols-2">
        {produtos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/produtos/${p.id}`}
              className="flex items-center gap-3.5 border-b border-border py-2.5 transition-colors hover:bg-accent/40"
            >
              <div className="relative size-13 shrink-0 overflow-hidden rounded-lg bg-muted opacity-65 grayscale">
                {p.capaPath ? (
                  <Image
                    src={`/media/${p.capaPath}-medio.webp`}
                    alt=""
                    fill
                    sizes="52px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <IconeCupcake className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-muted-foreground">
                {p.nome}
              </p>

              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Esgotado
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
