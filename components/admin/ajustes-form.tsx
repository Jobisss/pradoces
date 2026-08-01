'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { salvarMargemGlobal, type ConfigActionState } from '@/lib/actions/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ConfigActionState = {}

export function AjustesForm({ margemAtual }: { margemAtual: string }) {
  const [state, formAction, pending] = useActionState(salvarMargemGlobal, initialState)
  const toastedFor = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (state.ok && state.message && toastedFor.current !== state.message) {
      toastedFor.current = state.message
      toast(state.message)
    }
  }, [state.ok, state.message])

  return (
    <form action={formAction} className="max-w-md space-y-6" noValidate>
      {state.error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="margemMinimaPadrao">Margem mínima padrão (%)</Label>
        <Input
          id="margemMinimaPadrao"
          name="margemMinimaPadrao"
          inputMode="decimal"
          defaultValue={margemAtual}
          required
        />
        <p className="text-sm text-muted-foreground">
          Abaixo disso, o produto ganha um aviso vermelho. Hoje: {Number(margemAtual)}%.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar ajustes'}
      </Button>
    </form>
  )
}
