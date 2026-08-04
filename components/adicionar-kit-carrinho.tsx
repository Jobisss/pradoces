'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'

/** Kit não tem lote pra escolher — só quantidade, limitada pelo estoque livre dos componentes (kitDisponivel). */
export function AdicionarKitCarrinho({
  produtoId,
  produtoNome,
  precoUnitario,
  kitDisponivel,
}: {
  produtoId: string
  produtoNome: string
  precoUnitario: string
  kitDisponivel: number
}) {
  const router = useRouter()
  const { adicionar } = useCart()
  const [qtde, setQtde] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  function handleAdicionar() {
    adicionar({ tipo: 'KIT', produtoId, produtoNome, precoUnitario, kitDisponivel }, qtde)
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Quantidade</span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Diminuir quantidade"
            disabled={qtde <= 1}
            onClick={() => setQtde((q) => Math.max(1, q - 1))}
          >
            <MinusIcon className="size-4" />
          </Button>
          <span className="w-6 text-center tabular-nums text-base">{qtde}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Aumentar quantidade"
            disabled={qtde >= kitDisponivel}
            onClick={() => setQtde((q) => Math.min(kitDisponivel, q + 1))}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>

      <Button type="button" className="h-12 w-full text-base" onClick={handleAdicionar}>
        {adicionado ? 'Adicionado!' : 'Adicionar ao carrinho'}
      </Button>
      {adicionado && (
        <button
          type="button"
          onClick={() => router.push('/carrinho')}
          className="w-full text-center text-sm text-primary underline underline-offset-2"
        >
          Ver carrinho
        </button>
      )}
    </div>
  )
}
