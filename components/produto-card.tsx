import Link from 'next/link'
import Image from 'next/image'
import type { ProdutoCard as Produto } from '@/lib/catalogo/produtos'
import { IconeCupcake } from '@/components/home/motivos'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Card da vitrine (CAT-01/04). Só produto DISPONÍVEL — esgotado virou linha
 * compacta em `<TambemVendemos>`, porque dar a ele o mesmo peso visual de quem
 * gera reserva gastava a melhor área da página com estoque zerado.
 *
 * Decisões de forma, todas com motivo:
 *   - superfície branca + `shadow-doce`, sem borda (ver --shadow-doce em globals.css)
 *   - foto 4:5 em vez de quadrada: retrato favorece doce e dá mais pixel de foto
 *     na mesma largura de coluna
 *   - preço em `text-foreground`, não em `muted-foreground`: ele é a informação
 *     que decide a compra, não uma legenda
 *   - linha de sabores: "A partir de R$ 12,00" levantava "de qual sabor?" e o
 *     card não respondia (ver ProdutoCard.sabores)
 */
export function ProdutoCard({ p }: { p: Produto }) {
  return (
    <Link
      href={`/produtos/${p.id}`}
      className="group block overflow-hidden rounded-xl bg-card shadow-doce transition-all duration-200 hover:-translate-y-0.5 hover:shadow-doce-alta focus-visible:-translate-y-0.5 focus-visible:shadow-doce-alta"
    >
      <div className="relative aspect-4/5 bg-muted">
        {p.capaPath ? (
          <Image
            src={`/media/${p.capaPath}-medio.webp`}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <IconeCupcake className="size-12 text-accent-soft" />
          </div>
        )}

        {/*
          Só promoção. O selo de campanha saiu: a campanha já se anuncia no
          CampanhaBanner do layout E no chip de destaque da faixa de filtros —
          um terceiro aviso, repetido em cada card, era ruído. Quem quer ver só
          os doces da campanha usa o chip.

          Chocolate em vez de rosa porque o rosa é o fundo da própria foto em
          metade dos docinhos: o selo sumiria dentro dela.
        */}
        {p.emPromocao && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
            Promoção
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <p className="text-base leading-snug font-semibold text-foreground">{p.nome}</p>

        {p.sabores.length > 0 && (
          <p className="mt-1 truncate text-sm text-muted-foreground">{p.sabores.join(' · ')}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
          {p.precoAPartir && <span className="text-sm text-muted-foreground">A partir de</span>}
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {currency.format(Number(p.precoVenda))}
          </span>
          {p.precoOriginal && (
            <span className="text-sm text-muted-foreground line-through tabular-nums">
              {currency.format(Number(p.precoOriginal))}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
