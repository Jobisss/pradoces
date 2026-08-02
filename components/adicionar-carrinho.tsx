'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'

type LoteOpcao = { id: string; qtdeDisponivel: number; diasParaVencer: number }

function rotuloValidade(dias: number): string {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/** RES-01 — escolhe o lote (default: o que vence primeiro) e a quantidade, junta no carrinho. */
export function AdicionarCarrinho({
  produtoId,
  produtoNome,
  precoUnitario,
  lotes,
}: {
  produtoId: string
  produtoNome: string
  precoUnitario: string
  lotes: LoteOpcao[]
}) {
  const router = useRouter()
  const { adicionar } = useCart()
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '')
  const [qtde, setQtde] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  const lote = lotes.find((l) => l.id === loteId)
  if (!lote) return null

  function handleAdicionar() {
    adicionar(
      {
        loteId: lote!.id,
        produtoId,
        produtoNome,
        precoUnitario,
        validade: '',
        qtdeDisponivelNoLote: lote!.qtdeDisponivel,
      },
      qtde,
    )
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      {lotes.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="lote-select" className="text-sm font-medium">
            Qual lote?
          </label>
          <select
            id="lote-select"
            value={loteId}
            onChange={(e) => {
              setLoteId(e.target.value)
              setQtde(1)
            }}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {rotuloValidade(l.diasParaVencer)} · {l.qtdeDisponivel} disponíveis
              </option>
            ))}
          </select>
        </div>
      )}

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
            disabled={qtde >= lote.qtdeDisponivel}
            onClick={() => setQtde((q) => Math.min(lote!.qtdeDisponivel, q + 1))}
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
