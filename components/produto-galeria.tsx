'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from 'lucide-react'

/**
 * CAT-02 — troca de foto por botões (setas + miniaturas), sem depender de
 * scroll/hover.
 *
 * As setas eram `variant="secondary"` (branco) com opacity-90: sobre a foto de
 * um doce claro elas sumiam. Agora são chocolate sólido com ícone claro e um
 * degradê atrás, que é o que garante contraste sobre QUALQUER foto. Ganharam
 * também seta do teclado e arrasto com o dedo — no celular ninguém procura
 * botãozinho, desliza.
 */
export function ProdutoGaleria({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [indice, setIndice] = useState(0)
  const toqueX = useRef<number | null>(null)

  if (fotos.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-muted-foreground">
        <ImageOffIcon className="size-7" aria-hidden />
        <span className="text-sm">Sem foto por enquanto</span>
      </div>
    )
  }

  function ir(novoIndice: number) {
    setIndice((novoIndice + fotos.length) % fotos.length)
  }

  const varias = fotos.length > 1

  return (
    <div className="space-y-3">
      <div
        className="group relative aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10"
        tabIndex={varias ? 0 : undefined}
        role={varias ? 'group' : undefined}
        aria-label={varias ? `Fotos de ${nome}` : undefined}
        onKeyDown={(e) => {
          if (!varias) return
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            ir(indice - 1)
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            ir(indice + 1)
          }
        }}
        onTouchStart={(e) => {
          toqueX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (toqueX.current === null) return
          const delta = e.changedTouches[0].clientX - toqueX.current
          // 48px: menos que isso costuma ser tremida de dedo, não intenção.
          if (Math.abs(delta) > 48) ir(indice + (delta < 0 ? 1 : -1))
          toqueX.current = null
        }}
      >
        <Image
          src={`/media/${fotos[indice]}-grande.webp`}
          alt={`${nome} — foto ${indice + 1} de ${fotos.length}`}
          fill
          sizes="(min-width: 1024px) 520px, 100vw"
          className="object-cover"
          priority
        />

        {varias && (
          <>
            {/* Degradês nas bordas: é o que sustenta o contraste da seta
                quando a foto é clara justamente ali. */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-foreground/25 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-foreground/25 to-transparent"
              aria-hidden
            />

            <button
              type="button"
              className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/85 text-background backdrop-blur-sm transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
              aria-label="Foto anterior"
              onClick={() => ir(indice - 1)}
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/85 text-background backdrop-blur-sm transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
              aria-label="Próxima foto"
              onClick={() => ir(indice + 1)}
            >
              <ChevronRightIcon className="size-5" />
            </button>

            <span className="absolute bottom-3 right-3 rounded-full bg-foreground/85 px-2.5 py-1 text-xs font-medium tabular-nums text-background">
              {indice + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>

      {/* Miniatura em vez de bolinha: ela escolhe pela foto, não por posição. */}
      {varias && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((path, i) => (
            <button
              key={path}
              type="button"
              aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
              aria-current={i === indice}
              onClick={() => ir(i)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl transition-opacity ${
                i === indice
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                  : 'opacity-70 ring-1 ring-foreground/10 hover:opacity-100'
              }`}
            >
              <Image
                src={`/media/${path}-grande.webp`}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
