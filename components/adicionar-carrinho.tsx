'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type LoteOpcao = { id: string; qtdeDisponivel: number; diasParaVencer: number }
type VariacaoOpcao = { id: string; nome: string; precoVenda: string; lotes: LoteOpcao[] }

function rotuloValidade(dias: number): string {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/** RES-01/D-13 — escolhe a variação (sabor), depois o lote (default: o que vence primeiro) e a quantidade, junta no carrinho. */
export function AdicionarCarrinho({
  produtoId,
  produtoNome,
  variacoes,
}: {
  produtoId: string
  produtoNome: string
  variacoes: VariacaoOpcao[]
}) {
  const router = useRouter()
  const { adicionar } = useCart()
  const [variacaoId, setVariacaoId] = useState(variacoes[0]?.id ?? '')
  const [loteId, setLoteId] = useState(variacoes[0]?.lotes[0]?.id ?? '')
  const [qtde, setQtde] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  const variacao = variacoes.find((v) => v.id === variacaoId)
  if (!variacao) return null
  const lote = variacao.lotes.find((l) => l.id === loteId)

  function handleTrocarVariacao(id: string) {
    setVariacaoId(id)
    const nova = variacoes.find((v) => v.id === id)
    setLoteId(nova?.lotes[0]?.id ?? '')
    setQtde(1)
  }

  function handleAdicionar() {
    if (!lote) return
    adicionar(
      {
        tipo: 'UNITARIO',
        loteId: lote.id,
        produtoId,
        produtoNome: variacoes.length > 1 ? `${produtoNome} — ${variacao!.nome}` : produtoNome,
        precoUnitario: variacao!.precoVenda,
        validade: '',
        qtdeDisponivelNoLote: lote.qtdeDisponivel,
      },
      qtde,
    )
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="tabular-nums text-xl font-medium text-primary">{currency.format(Number(variacao.precoVenda))}</p>

      {variacoes.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="variacao-select" className="text-sm font-medium">
            Qual variação?
          </label>
          <select
            id="variacao-select"
            value={variacaoId}
            onChange={(e) => handleTrocarVariacao(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {variacoes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {!lote ? (
        <p className="text-sm text-muted-foreground">Essa variação esgotou — escolhe outra ou volta depois.</p>
      ) : (
        <>
          {variacao.lotes.length > 1 && (
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
                {variacao.lotes.map((l) => (
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
                onClick={() => setQtde((q) => Math.min(lote.qtdeDisponivel, q + 1))}
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
        </>
      )}
    </div>
  )
}
