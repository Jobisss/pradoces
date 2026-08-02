'use client'

import { useActionState } from 'react'
import { simularTaxaPontos, type SimuladorResultado } from '@/lib/actions/simulador-pontos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const initialState: SimuladorResultado = {}

export function SimuladorPontos({ pontosPorRealAtual, capAtual }: { pontosPorRealAtual: string; capAtual: string }) {
  const [state, formAction, pending] = useActionState(simularTaxaPontos, initialState)

  return (
    <div className="max-w-md space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-base font-semibold">Simulador de taxa</h2>
        <p className="text-sm text-muted-foreground">
          Se eu mudasse a taxa pra X, quanto teria sido creditado nos últimos 30 dias?
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        {state.error && (
          <p role="alert" className="text-sm text-muted-foreground">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sim-pontosPorReal">Pontos por real (hipotético)</Label>
          <Input id="sim-pontosPorReal" name="pontosPorReal" inputMode="decimal" defaultValue={pontosPorRealAtual} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sim-capPorReserva">Teto por reserva (hipotético)</Label>
          <Input id="sim-capPorReserva" name="capPorReserva" inputMode="numeric" defaultValue={capAtual} required />
        </div>

        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Calculando...' : 'Simular'}
        </Button>
      </form>

      {state.totalPontos !== undefined && (
        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <p>
            Nos últimos 30 dias, {state.totalReservas} reserva(s) confirmada(s) teriam gerado{' '}
            <span className="font-medium tabular-nums">{state.totalPontos} pontos</span>.
          </p>
          <p className="text-muted-foreground">
            Se cada ponto virar ~{currency.format(1)} em resgate no futuro, isso equivale a cerca de{' '}
            {currency.format(Number(state.custoEstimado))}.
          </p>
        </div>
      )}
    </div>
  )
}
