'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { salvarMargemGlobal, type ConfigActionState } from '@/lib/actions/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ConfigActionState = {}

type AjustesFormProps = {
  margemAtual: string
  pontosPorRealAtual: string
  pontosCapAtual: string
  pontosExpiracaoAtual: string
  janelaCancelamentoAtual: string
}

export function AjustesForm({
  margemAtual,
  pontosPorRealAtual,
  pontosCapAtual,
  pontosExpiracaoAtual,
  janelaCancelamentoAtual,
}: AjustesFormProps) {
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

      <div className="space-y-4 border-t border-border pt-4">
        <h2 className="text-base font-semibold">Pontos e reservas</h2>

        <div className="space-y-1.5">
          <Label htmlFor="pontosPorReal">Pontos por real reservado</Label>
          <Input id="pontosPorReal" name="pontosPorReal" inputMode="decimal" defaultValue={pontosPorRealAtual} required />
          <p className="text-sm text-muted-foreground">Hoje: R$ 1,00 vira {Number(pontosPorRealAtual)} ponto(s).</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pontosCapPorReserva">Teto de pontos por reserva</Label>
          <Input id="pontosCapPorReserva" name="pontosCapPorReserva" inputMode="numeric" defaultValue={pontosCapAtual} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pontosExpiracaoMeses">Pontos expiram depois de (meses)</Label>
          <Input
            id="pontosExpiracaoMeses"
            name="pontosExpiracaoMeses"
            inputMode="numeric"
            defaultValue={pontosExpiracaoAtual}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="janelaCancelamentoHoras">Janela de cancelamento (horas)</Label>
          <Input
            id="janelaCancelamentoHoras"
            name="janelaCancelamentoHoras"
            inputMode="numeric"
            defaultValue={janelaCancelamentoAtual}
            required
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar ajustes'}
      </Button>
    </form>
  )
}
