'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { corrigirCompra, type CompraActionState } from '@/lib/actions/compras'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: CompraActionState = {}

type CorrigirCompraFormProps = {
  compraId: string
  ingredienteId: string
  defaults: {
    dataCompra: string
    mercado: string
    marca: string
    qtdeEmbalagens: string
    tamanhoEmbalagem: string
    precoPorEmbalagem: string
  }
}

export function CorrigirCompraForm({ compraId, ingredienteId, defaults }: CorrigirCompraFormProps) {
  const router = useRouter()
  const boundAction = corrigirCompra.bind(null, compraId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.ok) router.push(`/admin/ingredientes/${ingredienteId}`)
  }, [state.ok, ingredienteId, router])

  return (
    <form action={formAction} className="mx-auto w-full max-w-md space-y-6" noValidate>
      {state.error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {state.error}
        </p>
      )}

      <input type="hidden" name="ingredienteId" value={ingredienteId} />

      <div className="space-y-1.5">
        <Label htmlFor="dataCompra">Quando</Label>
        <Input id="dataCompra" name="dataCompra" type="date" defaultValue={defaults.dataCompra} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mercado">Onde você comprou</Label>
        <Input id="mercado" name="mercado" defaultValue={defaults.mercado} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="marca">Marca</Label>
        <Input id="marca" name="marca" defaultValue={defaults.marca} required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="qtdeEmbalagens">Quantas embalagens</Label>
          <Input
            id="qtdeEmbalagens"
            name="qtdeEmbalagens"
            inputMode="decimal"
            defaultValue={defaults.qtdeEmbalagens}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tamanhoEmbalagem">Tamanho de cada uma</Label>
          <Input
            id="tamanhoEmbalagem"
            name="tamanhoEmbalagem"
            inputMode="decimal"
            defaultValue={defaults.tamanhoEmbalagem}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="precoPorEmbalagem">Preço de cada uma (R$)</Label>
          <Input
            id="precoPorEmbalagem"
            name="precoPorEmbalagem"
            inputMode="decimal"
            defaultValue={defaults.precoPorEmbalagem}
            required
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Salvando...' : 'Corrigir compra'}
      </Button>
    </form>
  )
}
