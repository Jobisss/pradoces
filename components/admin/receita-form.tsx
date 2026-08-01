'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import Decimal from 'decimal.js'
import { XIcon } from 'lucide-react'
import { criarReceita, editarReceita } from '@/lib/actions/receitas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

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
 */
export function ReceitaForm({ ingredientes, defaults }: ReceitaFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ReceitaFormValues>({
    defaultValues: {
      nome: defaults?.nome ?? '',
      rendimentoPadrao: defaults ? String(defaults.rendimentoPadrao) : '',
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

  const faltantes = new Set<string>()
  let totalPreview = new Decimal(0)
  for (const item of itensAtuais) {
    if (!item.ingredienteId) continue
    const ing = ingredienteById(item.ingredienteId)
    if (!ing) continue
    if (!ing.custoPorUnidadeBase) {
      faltantes.add(ing.nome)
      continue
    }
    const qtde = toDecimal(item.qtde ?? '')
    if (!qtde) continue
    totalPreview = totalPreview.plus(qtde.times(new Decimal(ing.custoPorUnidadeBase)))
  }
  const gas = toDecimal(custoGasAtual ?? '')
  if (gas) totalPreview = totalPreview.plus(gas)
  const rendimento = Number(rendimentoAtual)
  const porUnidadePreview =
    rendimento > 0 ? totalPreview.dividedBy(rendimento) : new Decimal(0)

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

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-40 md:pb-0" noValidate>
        {serverError && (
          <p role="alert" className="text-sm text-muted-foreground">
            {serverError}
          </p>
        )}

        <FormField
          control={control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da receita</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ingredientes (pra um lote)</h2>

          {fields.map((field, index) => {
            const itemValue = itensAtuais[index]
            const ing = itemValue ? ingredienteById(itemValue.ingredienteId) : undefined
            const unidade = ing?.unidadeBase ?? 'un'
            return (
              <div key={field.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <FormField
                      control={control}
                      name={`itens.${index}.ingredienteId`}
                      render={({ field: selectField }) => (
                        <FormItem>
                          <FormLabel>Ingrediente</FormLabel>
                          <Select value={selectField.value} onValueChange={selectField.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Escolhe um ingrediente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ingredientes.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-6 size-11 shrink-0"
                    aria-label="Remover ingrediente"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <XIcon />
                  </Button>
                </div>

                <FormField
                  control={control}
                  name={`itens.${index}.qtde`}
                  render={({ field: qtdeField }) => (
                    <FormItem>
                      <FormLabel>Quantidade ({unidade})</FormLabel>
                      <FormControl>
                        <Input {...qtdeField} inputMode="decimal" placeholder="0" />
                      </FormControl>
                      {ing && !ing.custoPorUnidadeBase && (
                        <p className="text-sm text-muted-foreground">
                          {ing.nome} ainda não tem compra registrada — o custo fica incompleto até
                          você registrar uma.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => append({ ingredienteId: '', qtde: '' })}
          >
            Mais um ingrediente
          </Button>
        </div>

        <FormField
          control={control}
          name="rendimentoPadrao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rende quantas unidades</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="custoGas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gasto de gás/energia por lote (R$) — se quiser</FormLabel>
              <FormControl>
                <Input {...field} inputMode="decimal" placeholder="0,00" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="validadeDias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dura quantos dias</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" placeholder="7" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-1 rounded-lg border border-border bg-card p-4">
          <p className="tabular-nums text-base font-medium">
            Custo do lote hoje: {currency.format(totalPreview.toNumber())} ·{' '}
            {currency.format(porUnidadePreview.toNumber())} por unidade
          </p>
          <p className="text-xs text-muted-foreground">
            calculado com a última compra de cada ingrediente
          </p>
          {[...faltantes].map((nome) => (
            <p key={nome} className="text-sm text-muted-foreground">
              {nome} ainda não tem compra registrada — o custo fica incompleto até você registrar
              uma.
            </p>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto w-full max-w-md">
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar receita'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
