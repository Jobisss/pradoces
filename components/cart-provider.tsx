'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type CartItemUnitario = {
  tipo: 'UNITARIO'
  loteId: string
  produtoId: string
  produtoNome: string
  precoUnitario: string
  qtde: number
  validade: string
  qtdeDisponivelNoLote: number
}

/** Kit não tem lote próprio (é montado a partir dos componentes na hora da reserva) — o limite aqui é kitDisponivel, calculado a partir do estoque livre dos componentes. */
export type CartItemKit = {
  tipo: 'KIT'
  produtoId: string
  produtoNome: string
  precoUnitario: string
  qtde: number
  kitDisponivel: number
}

export type CartItem = CartItemUnitario | CartItemKit
/** `Omit<Union, K>` não distribui pelas variantes (perde o discriminante) — união explícita dos Omits individuais. */
export type NovoCartItem = Omit<CartItemUnitario, 'qtde'> | Omit<CartItemKit, 'qtde'>

/** Chave de identidade no carrinho: lote pro item avulso, produto pro kit (kit não tem lote). */
function chave(item: Pick<CartItem, 'tipo' | 'produtoId'> & { loteId?: string }): string {
  return item.tipo === 'KIT' ? `kit:${item.produtoId}` : `lote:${item.loteId}`
}

function limiteDisponivel(item: CartItem): number {
  return item.tipo === 'KIT' ? item.kitDisponivel : item.qtdeDisponivelNoLote
}

type CartContextValue = {
  itens: CartItem[]
  adicionar: (item: NovoCartItem, qtde: number) => void
  remover: (item: CartItem) => void
  atualizarQtde: (item: CartItem, qtde: number) => void
  limpar: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'luizinha-carrinho'

/**
 * RES-01 — carrinho simples: sem checkout, sem pagamento, só junta o que vai
 * ser reservado. Vive no localStorage (client-only, sem servidor até o
 * submit final) — perde o carrinho se trocar de navegador, aceitável pro
 * caso de uso (reserva pequena, sessão única).
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<CartItem[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItens(JSON.parse(raw))
    } catch {
      // localStorage corrompido/indisponível — segue com carrinho vazio.
    }
    setCarregado(true)
  }, [])

  useEffect(() => {
    if (!carregado) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
  }, [itens, carregado])

  const adicionar = useCallback((item: Omit<CartItem, 'qtde'>, qtde: number) => {
    setItens((prev) => {
      const chaveNova = chave(item)
      const existente = prev.find((i) => chave(i) === chaveNova)
      if (existente) {
        const novaQtde = Math.min(existente.qtde + qtde, limiteDisponivel(existente))
        return prev.map((i) => (chave(i) === chaveNova ? { ...i, qtde: novaQtde } : i))
      }
      return [...prev, { ...item, qtde: Math.min(qtde, limiteDisponivel(item as CartItem)) } as CartItem]
    })
  }, [])

  const remover = useCallback((item: CartItem) => {
    const alvo = chave(item)
    setItens((prev) => prev.filter((i) => chave(i) !== alvo))
  }, [])

  const atualizarQtde = useCallback((item: CartItem, qtde: number) => {
    const alvo = chave(item)
    setItens((prev) =>
      prev.map((i) => (chave(i) === alvo ? { ...i, qtde: Math.max(1, Math.min(qtde, limiteDisponivel(i))) } : i)),
    )
  }, [])

  const limpar = useCallback(() => setItens([]), [])

  return (
    <CartContext.Provider value={{ itens, adicionar, remover, atualizarQtde, limpar }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>')
  return ctx
}
