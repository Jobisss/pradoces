'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MinusIcon, PlusIcon, CheckIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Kit não tem lote pra escolher — só quantidade, limitada pelo estoque livre
 * dos componentes (kitDisponivel). Mesma carcaça do bloco de UNITARIO: preço
 * dentro do card e altura estável (o "ver carrinho" tinha espaço próprio, em
 * vez de empurrar a página quando aparece).
 */
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
    <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {currency.format(Number(precoUnitario))}
      </p>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="space-y-0.5">
          <span className="block text-sm font-medium">Quantidade</span>
          <span className="block text-[13px] tabular-nums text-muted-foreground">
            dá pra montar {kitDisponivel} {kitDisponivel === 1 ? 'kit' : 'kits'} agora
          </span>
        </div>
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
          <span className="w-6 text-center text-base tabular-nums">{qtde}</span>
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

      <Button type="button" className="h-12 w-full gap-2 text-base" onClick={handleAdicionar}>
        {adicionado && <CheckIcon className="size-[18px]" aria-hidden />}
        {adicionado ? 'Adicionado!' : 'Adicionar ao carrinho'}
      </Button>

      <div className="flex h-6 items-center justify-center">
        {adicionado && (
          <button
            type="button"
            onClick={() => router.push('/carrinho')}
            className="text-sm font-medium underline underline-offset-2"
          >
            Ver carrinho
          </button>
        )}
      </div>
    </div>
  )
}
