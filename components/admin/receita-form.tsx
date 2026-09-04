'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import Decimal from 'decimal.js'
import { XIcon, BookOpen, Plus } from 'lucide-react'
import { criarReceita, editarReceita } from '@/lib/actions/receitas'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form'
import {
  FormLayout,
  FormSection,
  Field,
  FieldRow,
  AdminInput,
  AdminSelectTrigger,
  InputWithSuffix,
  FormAlert,
  CostCard,
  RailNote,
  FormActions,
} from '@/components/admin/form'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function toDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed || Number.isNaN(Number(trimmed))) return null
  try {
    return new Decimal(trimmed)
  } catch {
    return null
  }
}

type ReceitaFormValues = {
  nome: string
  rendimentoPadrao: string
  minutosPreparo: string
  custoGas: string
  validadeDias: string
  itens: Array<{ ingredienteId: string; qtde: string }>
}

type ReceitaFormProps = {
  ingredientes: Array<{
    id: string
    nome: string
    unidadeBase: 'g' | 'ml' | 'un'
    custoPorUnidadeBase: string | null
  }>
  defaults?: {
    id: string
    nome: string
    rendimentoPadrao: number
    custoGas: string | null
    minutosPreparo: number | null
    validadeDias: number | null
    itens: Array<{ ingredienteId: string; qtde: string }>
  }
}

/**
 * Form RHF + useFieldArray de receita (novo/editar), com resumo de custo AO
 * VIVO (REC-05) calculado no client via decimal.js a partir do
 * custoPorUnidadeBase (string) de cada ingrediente — NUNCA soma/multiplica
 * com +/* nativo do JS, e nunca importa o Decimal do lado do servidor
 * (Pitfall 3: Decimal não atravessa a fronteira RSC->Client).
 *
 * O custo vive no trilho da direita, não num parágrafo cinza no rodapé: é o
 * número que a receita inteira existe pra produzir.
 */
export function ReceitaForm({ ingredientes, defaults }: ReceitaFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ReceitaFormValues>({
    defaultValues: {
      nome: defaults?.nome ?? '',
      rendimentoPadrao: defaults ? String(defaults.rendimentoPadrao) : '',
      minutosPreparo: defaults?.minutosPreparo ? String(defaults.minutosPreparo) : '',
      custoGas: defaults?.custoGas ?? '',
      validadeDias: defaults?.validadeDias ? String(defaults.validadeDias) : '',
      itens: defaults?.itens ?? [{ ingredienteId: '', qtde: '' }],
    },
  })
  const { control, handleSubmit, watch } = form

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  const itensAtuais = watch('itens')
  const rendimentoAtual = watch('rendimentoPadrao')
  const custoGasAtual = watch('custoGas')

  function ingredienteById(id: string) {
    return ingredientes.find((i) => i.id === id)
  }

  /** Custo de UMA linha com a última compra do ingrediente — null se falta compra. */
  function custoDaLinha(item: { ingredienteId: string; qtde: string }): Decimal | null {
    const ing = ingredienteById(item.ingredienteId)
    if (!ing?.custoPorUnidadeBase) return null
    const qtde = toDecimal(item.qtde ?? '')
    if (!qtde) return null
    return qtde.times(new Decimal(ing.custoPorUnidadeBase))
  }

  const faltantes = new Set<string>()
  let totalIngredientes = new Decimal(0)
  for (const item of itensAtuais) {
    if (!item.ingredienteId) continue
    const ing = ingredienteById(item.ingredienteId)
    if (!ing) continue
    if (!ing.custoPorUnidadeBase) {
      faltantes.add(ing.nome)
      continue
    }
    const custo = custoDaLinha(item)
    if (custo) totalIngredientes = totalIngredientes.plus(custo)
  }
  const gas = toDecimal(custoGasAtual ?? '')
  const totalPreview = gas ? totalIngredientes.plus(gas) : totalIngredientes
  const rendimento = Number(rendimentoAtual)
  const porUnidadePreview = rendimento > 0 ? totalPreview.dividedBy(rendimento) : new Decimal(0)

  function onSubmit(data: ReceitaFormValues) {
    setServerError(null)
    startTransition(async () => {
      const res = defaults ? await editarReceita(defaults.id, data) : await criarReceita(data)
      if (res?.error) {
        setServerError(res.error)
        return
      }
      router.push('/admin/receitas')
    })
  }

  const rail = (
    <CostCard
      label="Custo do lote hoje"
      value={currency.format(totalPreview.toNumber())}
      sub={
        rendimento > 0
          ? `${currency.format(porUnidadePreview.toNumber())} por unidade · rende ${rendimento}`
          : 'preenche o rendimento pra ver o custo por unidade'
      }
      icon={BookOpen}
      rows={[
        { label: 'Ingredientes com compra', value: currency.format(totalIngredientes.toNumber()) },
        ...(gas ? [{ label: 'Gás', value: currency.format(gas.toNumber()) }] : []),
        ...[...faltantes].map((nome) => ({
          label: nome,
          value: 'falta compra',
          tone: 'warn' as const,
        })),
      ]}
    >
      {faltantes.size > 0 && (
        <RailNote>
          Esse valor sobe quando você registrar a compra de{' '}
          {[...faltantes].join(', ')}.
        </RailNote>
      )}
    </CostCard>
  )

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormLayout rail={rail}>
          {serverError && <FormAlert title="Não deu pra salvar a receita" detail={serverError} />}

          <FormSection title="Identidade">
            <FieldRow>
              <FormField
                control={control}
                name="nome"
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-0 flex-[2] gap-0">
                    <Field label="Nome da receita" error={fieldState.error?.message}>
                      <FormControl>
                        <AdminInput {...field} required />
                      </FormControl>
                    </Field>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="rendimentoPadrao"
                render={({ field, fieldState }) => (
                  <FormItem className="gap-0 sm:w-52">
                    <Field label="Rende" error={fieldState.error?.message}>
                      <FormControl>
                        <InputWithSuffix {...field} inputMode="numeric" suffix="un" required />
                      </FormControl>
                    </Field>
                  </FormItem>
                )}
              />
            </FieldRow>
          </FormSection>

          <FormSection
            title="Ingredientes de um lote"
            hint="Quantidade de UM lote inteiro, na unidade do ingrediente. Na hora de produzir a gente multiplica sozinho."
          >
            <div className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const itemValue = itensAtuais[index]
                const ing = itemValue ? ingredienteById(itemValue.ingredienteId) : undefined
                const unidade = ing?.unidadeBase ?? 'un'
                const semCompra = !!ing && !ing.custoPorUnidadeBase
                const custoLinha = itemValue ? custoDaLinha(itemValue) : null

                return (
                  <div
                    key={field.id}
                    className="flex flex-col gap-3 rounded-xl bg-background p-3.5 sm:flex-row sm:items-start"
                  >
                    <FormField
                      control={control}
                      name={`itens.${index}.ingredienteId`}
                      render={({ field: selectField, fieldState }) => (
                        <FormItem className="min-w-0 flex-[2] gap-0">
                          <Field
                            label="Ingrediente"
                            error={
                              fieldState.error?.message ??
                              (semCompra
                                ? 'Sem compra registrada — o custo da receita fica incompleto'
                                : undefined)
                            }
                          >
                            <Select value={selectField.value} onValueChange={selectField.onChange}>
                              <FormControl>
                                <AdminSelectTrigger>
                                  <SelectValue placeholder="Escolhe um ingrediente" />
                                </AdminSelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ingredientes.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`itens.${index}.qtde`}
                      render={({ field: qtdeField, fieldState }) => (
                        <FormItem className="gap-0 sm:w-44">
                          <Field label="Quantidade" error={fieldState.error?.message}>
                            <FormControl>
                              <InputWithSuffix
                                {...qtdeField}
                                inputMode="decimal"
                                placeholder="0"
                                suffix={unidade}
                              />
                            </FormControl>
                          </Field>
                        </FormItem>
                      )}
                    />

                    <div className="flex items-end gap-2 sm:w-40 sm:pt-[27px]">
                      <span
                        className={`flex h-11 flex-1 items-center text-[15px] font-semibold tabular-nums ${semCompra ? 'text-warn' : ''}`}
                      >
                        {custoLinha ? currency.format(custoLinha.toNumber()) : '—'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-11 shrink-0"
                        aria-label="Remover ingrediente"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    <FormMessage />
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-dashed text-[15px]"
              onClick={() => append({ ingredienteId: '', qtde: '' })}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar ingrediente
            </Button>
          </FormSection>

          <FormSection
            title="Tempo, gás e validade"
            hint="O tempo vira custo de mão de obra no lote, usando o valor/hora dos Ajustes — é o que faz o lucro parar de esconder o pagamento do seu trabalho."
          >
            <FieldRow>
              <FormField
                control={control}
                name="minutosPreparo"
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-0 flex-1 gap-0">
                    <Field
                      label="Tempo pra fazer um lote"
                      optional
                      error={fieldState.error?.message}
                      hint="Do começo ao fim, incluindo montar e embalar. Fazer 2× a receita conta 2× o tempo."
                    >
                      <FormControl>
                        <InputWithSuffix
                          {...field}
                          inputMode="numeric"
                          placeholder="90"
                          suffix="min"
                        />
                      </FormControl>
                    </Field>
                  </FormItem>
                )}
              />
            </FieldRow>
            <FieldRow>
              <FormField
                control={control}
                name="custoGas"
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-0 flex-1 gap-0">
                    <Field
                      label="Custo de gás por lote (R$)"
                      optional
                      error={fieldState.error?.message}
                      hint="Quanto você estima de botijão por fornada."
                    >
                      <FormControl>
                        <AdminInput {...field} inputMode="decimal" placeholder="0,00" />
                      </FormControl>
                    </Field>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="validadeDias"
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-0 flex-1 gap-0">
                    <Field
                      label="Validade"
                      optional
                      error={fieldState.error?.message}
                      hint="Vira sugestão automática na hora de produzir."
                    >
                      <FormControl>
                        <InputWithSuffix {...field} inputMode="numeric" placeholder="7" suffix="dias" />
                      </FormControl>
                    </Field>
                  </FormItem>
                )}
              />
            </FieldRow>
          </FormSection>

          <FormActions note="O custo acompanha o preço da última compra de cada ingrediente — muda sozinho quando você for ao mercado.">
            <Button type="submit" className="h-12 px-6 text-base" disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar receita'}
            </Button>
          </FormActions>
        </FormLayout>
      </form>
    </Form>
  )
}
