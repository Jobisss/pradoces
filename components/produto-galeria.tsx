'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** CAT-02 — troca de foto por botões (setas + bolinhas), sem depender de scroll/hover. */
export function ProdutoGaleria({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [indice, setIndice] = useState(0)

  if (fotos.length === 0) {
    return (
      <div className="mb-4 flex aspect-square items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Sem foto
      </div>
    )
  }

  function ir(novoIndice: number) {
    setIndice((novoIndice + fotos.length) % fotos.length)
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        <Image src={`/uploads/${fotos[indice]}-grande.webp`} alt={nome} fill sizes="100vw" className="object-cover" priority />

        {fotos.length > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 size-11 -translate-y-1/2 rounded-full opacity-90"
              aria-label="Foto anterior"
              onClick={() => ir(indice - 1)}
            >
              <ChevronLeftIcon className="size-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full opacity-90"
              aria-label="Próxima foto"
              onClick={() => ir(indice + 1)}
            >
              <ChevronRightIcon className="size-5" />
            </Button>
          </>
        )}
      </div>

      {fotos.length > 1 && (
        <div className="flex justify-center gap-2">
          {fotos.map((path, i) => (
            <button
              key={path}
              type="button"
              aria-label={`Ir pra foto ${i + 1} de ${fotos.length}`}
              aria-current={i === indice}
              className="flex size-11 items-center justify-center"
              onClick={() => ir(i)}
            >
              <span className={`size-2.5 rounded-full ${i === indice ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
