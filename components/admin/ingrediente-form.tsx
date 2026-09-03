'use client'

import { useActionState } from 'react'
import { criarIngrediente, editarIngrediente, type IngredienteActionState } from '@/lib/actions/ingredientes'
import { Button } from '@/components/ui/button'
import {
  FormLayout,
  FormSection,
  Field,
  AdminInput,
  OptionCards,
  FormAlert,
  FormActions,
} from '@/components/admin/form'

const initialState: IngredienteActionState = {}

const UNIDADES = [
  { value: 'g', title: 'Gramas (g)', hint: 'farinha, chocolate, manteiga' },
  { value: 'ml', title: 'Mililitros (ml)', hint: 'leite, creme de leite, essência' },
  { value: 'un', title: 'Unidade (un)', hint: 'ovo, forminha, caixa' },
]

const UNIDADE_LABEL: Record<string, string> = {
  g: 'gramas (g)',
  ml: 'mililitros (ml)',
  un: 'unidade (un)',
}

const TIPOS = [
  { value: 'INGREDIENTE', title: 'Ingrediente', hint: 'entra na receita e vira massa' },
  { value: 'EMBALAGEM', title: 'Embalagem', hint: 'forminha, caixa, fita, sacola' },
]

const PROXIMOS_PASSOS = [
  'Registra uma compra em “Fui ao mercado” — é ela que dá o custo.',
  'Usa o ingrediente numa receita.',
  'O custo do doce passa a se atualizar sozinho a cada compra nova.',
]

type IngredienteFormProps = {
  defaults?: {
    id: string
    nome: string
    unidadeBase: 'g' | 'ml' | 'un'
    tipo: 'INGREDIENTE' | 'EMBALAGEM'
    travarUnidade: boolean
  }
}

export function IngredienteForm({ defaults }: IngredienteFormProps) {
  const action = defaults ? editarIngrediente.bind(null, defaults.id) : criarIngrediente
  const [state, formAction, pending] = useActionState(action, initialState)
  const fieldErrors = state.fieldErrors ?? {}

  const rail = (
    <div className="flex flex-col gap-2.5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa">
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        Depois disso
      </span>
      {PROXIMOS_PASSOS.map((passo, i) => (
        <div key={i} className="flex items-start gap-2.5 py-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {i + 1}
          </span>
          <span className="text-[13px] leading-normal text-muted-foreground">{passo}</span>
        </div>
      ))}
    </div>
  )

  return (
    <form action={formAction} noValidate>
      <FormLayout rail={rail}>
        {state.error && <FormAlert title="Não deu pra salvar" detail={state.error} />}

        <FormSection title="O básico" hint="Só isso já basta pra começar a registrar compras.">
          <Field
            label="Nome"
            htmlFor="nome"
            error={fieldErrors.nome?.[0]}
            hint="Como você chama no mercado. A marca vem depois, na hora da compra."
          >
            <AdminInput id="nome" name="nome" defaultValue={defaults?.nome} required />
          </Field>

          <Field
            label="Como você mede"
            hint={
              defaults?.travarUnidade
                ? undefined
                : 'Depois da primeira compra registrada isso trava — é o que mantém o histórico de custo comparável.'
            }
          >
            {defaults?.travarUnidade ? (
              <div className="space-y-1.5">
                <p className="flex h-11 items-center rounded-[10px] bg-background px-3.5 text-[15px]">
                  {UNIDADE_LABEL[defaults.unidadeBase]}
                </p>
                <input type="hidden" name="unidadeBase" value={defaults.unidadeBase} />
                <p className="text-[13px] text-muted-foreground">
                  Esse ingrediente já tem compras registradas — a unidade não pode mais mudar.
                </p>
              </div>
            ) : (
              <OptionCards name="unidadeBase" options={UNIDADES} defaultValue={defaults?.unidadeBase} />
            )}
          </Field>

          <Field label="É ingrediente ou embalagem?">
            <OptionCards name="tipo" options={TIPOS} defaultValue={defaults?.tipo ?? 'INGREDIENTE'} />
          </Field>
        </FormSection>

        <FormActions note="Você ainda vai poder editar o nome depois — só a unidade trava.">
          <Button type="submit" className="h-12 px-6 text-base" disabled={pending}>
            {pending ? 'Salvando...' : defaults ? 'Salvar alterações' : 'Salvar ingrediente'}
          </Button>
        </FormActions>
      </FormLayout>
    </form>
  )
}
