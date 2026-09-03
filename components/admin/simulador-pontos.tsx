'use client'

import { useActionState } from 'react'
import { simularTaxaPontos, type SimuladorResultado } from '@/lib/actions/simulador-pontos'
import { Button } from '@/components/ui/button'
import { Field, InputWithSuffix, FormAlert } from '@/components/admin/form'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const initialState: SimuladorResultado = {}

/**
 * PT-09 — testar a devolução com os números reais dos últimos 30 dias ANTES
 * de mudar o ajuste pra valer. Na regra nova o custo do programa é
 * simplesmente `lucro × devolução%`, então dá pra responder a pergunta que
 * importa ("quanto isso me custa?") sem estimativa nenhuma.
 */
export function SimuladorPontos({ devolucaoAtual }: { devolucaoAtual: string }) {
  const [state, formAction, pending] = useActionState(simularTaxaPontos, initialState)

  return (
    <div className="flex flex-col gap-[18px] rounded-xl bg-card px-6 pb-6 pt-[22px] ring-1 ring-foreground/10 shadow-doce-baixa">
      <div className="space-y-0.5">
        <h2 className="text-[17px] font-semibold tracking-tight">Testar antes de mudar</h2>
        <p className="max-w-[62ch] text-[13px] leading-normal text-muted-foreground">
          Se a devolução fosse outra, quanto o programa de pontos teria custado nos últimos 30 dias?
          Roda com as vendas reais do período.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-4" noValidate>
        <Field
          label="Devolução hipotética"
          htmlFor="sim-devolucao"
          className="sm:max-w-56"
          error={state.fieldErrors?.pontosDevolucaoPercent?.[0]}
        >
          <InputWithSuffix
            id="sim-devolucao"
            name="pontosDevolucaoPercent"
            inputMode="decimal"
            defaultValue={devolucaoAtual}
            suffix="%"
            required
          />
        </Field>
        <Button type="submit" variant="outline" className="h-11" disabled={pending}>
          {pending ? 'Calculando...' : 'Simular'}
        </Button>
      </form>

      {state.error && <FormAlert title="Não deu pra simular" detail={state.error} />}

      {state.totalPontos !== undefined && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Lucro em 30 dias
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {currency.format(Number(state.lucroPeriodo))}
              </p>
              <p className="text-[13px] tabular-nums text-muted-foreground">
                de {currency.format(Number(state.faturamentoPeriodo))} faturados ·{' '}
                {state.totalReservas} reservas
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Pontos creditados
              </p>
              <p className="text-xl font-semibold tabular-nums">{state.totalPontos}</p>
              <p className="text-[13px] text-muted-foreground">o que a clientela teria juntado</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Custo do programa
              </p>
              <p
                className={`text-xl font-semibold tabular-nums ${state.arriscado ? 'text-destructive' : 'text-success'}`}
              >
                {currency.format(Number(state.custoEstimado))}
              </p>
              <p className="text-[13px] text-muted-foreground">em ingrediente dado de brinde</p>
            </div>
          </div>

          <p
            className={
              state.arriscado
                ? 'text-[13px] font-medium text-destructive'
                : 'text-[13px] text-muted-foreground'
            }
          >
            Devolver {state.devolucaoPercent}% do lucro, contra {state.margemMinimaPadrao}% de margem
            mínima configurada.{' '}
            {state.arriscado
              ? 'Está igual ou acima da margem mínima — nesse ritmo o brinde come o lucro que justificou ele.'
              : 'Folga confortável: o programa se paga com sobra.'}
          </p>
        </div>
      )}
    </div>
  )
}
