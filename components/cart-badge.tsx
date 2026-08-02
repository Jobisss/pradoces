'use client'

import Link from 'next/link'
import { ShoppingBagIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'

export function CartBadge() {
  const { itens } = useCart()
  const total = itens.reduce((soma, i) => soma + i.qtde, 0)

  return (
    <Link
      href="/carrinho"
      aria-label={`Carrinho, ${total} ${total === 1 ? 'item' : 'itens'}`}
      className="relative flex size-11 items-center justify-center rounded-lg border border-border text-foreground"
    >
      <ShoppingBagIcon className="size-5" aria-hidden />
      {total > 0 && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {total}
        </span>
      )}
    </Link>
  )
}
