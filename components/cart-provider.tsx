'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type CartItem = {
  loteId: string
  produtoId: string
  produtoNome: string
  precoUnitario: string
  qtde: number
  validade: string
  qtdeDisponivelNoLote: number
}

type CartContextValue = {
  itens: CartItem[]
  adicionar: (item: Omit<CartItem, 'qtde'>, qtde: number) => void
  remover: (loteId: string) => void
  atualizarQtde: (loteId: string, qtde: number) => void
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
      const existente = prev.find((i) => i.loteId === item.loteId)
      if (existente) {
        const novaQtde = Math.min(existente.qtde + qtde, existente.qtdeDisponivelNoLote)
        return prev.map((i) => (i.loteId === item.loteId ? { ...i, qtde: novaQtde } : i))
      }
      return [...prev, { ...item, qtde: Math.min(qtde, item.qtdeDisponivelNoLote) }]
    })
  }, [])

  const remover = useCallback((loteId: string) => {
    setItens((prev) => prev.filter((i) => i.loteId !== loteId))
  }, [])

  const atualizarQtde = useCallback((loteId: string, qtde: number) => {
    setItens((prev) =>
      prev.map((i) => (i.loteId === loteId ? { ...i, qtde: Math.max(1, Math.min(qtde, i.qtdeDisponivelNoLote)) } : i)),
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
