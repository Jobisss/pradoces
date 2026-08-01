'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import Decimal from 'decimal.js'
import { TriangleAlert, XIcon } from 'lucide-react'
import { criarProduto, editarProduto, sugestoesCategoria } from '@/lib/actions/produtos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { SuggestInput } from '@/components/admin/suggest-input'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

function margemPercent(preco: Decimal, custo: Decimal): Decimal {
  if (preco.lessThanOrEqualTo(0)) return new Decimal(0)
  return preco.minus(custo).dividedBy(preco).times(100)
}

type OpcaoCusto = { id: string; nome: string; custoPorUnidade: string | null }

type ProdutoFormValues = {
  nome: string
  descricao: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  precoVenda: string
  margemMinimaOverride: string
  receitaId: string
  recheioReceitaId: string
  kitItens: Array<{ componenteId: string; qtde: string }>
}

type ProdutoFormProps = {
  receitas: OpcaoCusto[]
  recheios: OpcaoCusto[]
  unitarios: OpcaoCusto[]
  margemMinimaGlobal: string
  defaults?: {
    id: string
    nome: string
    descricao: string
    categoria: string
    tipo: 'UNITARIO' | 'KIT'
    precoVenda: string
    margemMinimaOverride: string | null
    receitaId: string | null
    recheioReceitaId: string | null
    kitItens: Array<{ componenteId: string; qtde: number }>
  }
}

/**
 * Form de produto — bloco de margem AO VIVO (D-09) com os 3 estados do
 * UI-SPEC: saudável, abaixo do mínimo (borda+ícone+texto, nunca só cor) e
 * bloqueio PROD-09 (preço < custo). O bloqueio aqui é cortesia visual — quem
 * decide de verdade é a action (lib/actions/produtos.ts), testado no 02-06.
 */
export function ProdutoForm({ receitas, recheios, unitarios, margemMinimaGlobal, defaults }: ProdutoFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ProdutoFormValues>({
    defaultValues: {
      nome: defaults?.nome ?? '',
      descricao: defaults?.descricao ?? '',
      categoria: defaults?.categoria ?? '',
      tipo: defaults?.tipo ?? 'UNITARIO',
      precoVenda: defaults?.precoVenda ?? '',
      margemMinimaOverride: defaults?.margemMinimaOverride ?? '',
      receitaId: defaults?.receitaId ?? '',
      recheioReceitaId: defaults?.recheioReceitaId ?? '',
      kitItens: defaults?.kitItens.map((i) => ({ componenteId: i.componenteId, qtde: String(i.qtde) })) ?? [],
    },
  })
  const { control, handleSubmit, watch, setValue } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'kitItens' })

  const tipo = watch('tipo')
  const receitaId = watch('receitaId')
  const recheioReceitaId = watch('recheioReceitaId')
  const kitItens = watch('kitItens')
  const precoVendaRaw = watch('precoVenda')
  const margemOverrideRaw = watch('margemMinimaOverride')
  const categoria = watch('categoria')

  let custo: Decimal | null = null
  if (tipo === 'UNITARIO') {
    const r = receitas.find((x) => x.id === receitaId)
    const base = r?.custoPorUnidade ? new Decimal(r.custoPorUnidade) : null
    if (base && recheioReceitaId) {
      const recheio = recheios.find((x) => x.id === recheioReceitaId)
      const custoRecheio = recheio?.custoPorUnidade ? new Decimal(recheio.custoPorUnidade) : new Decimal(0)
      custo = base.plus(custoRecheio)
    } else {
      custo = base
    }
  } else {
    let total = new Decimal(0)
    let algumFaltando = kitItens.length === 0
    for (const item of kitItens) {
      if (!item.componenteId) {
        algumFaltando = true
        continue
      }
      const u = unitarios.find((x) => x.id === item.componenteId)
      if (!u?.custoPorUnidade) {
        algumFaltando = true
        continue
      }
      total = total.plus(new Decimal(u.custoPorUnidade).times(Number(item.qtde) || 0))
    }
    custo = algumFaltando ? null : total
  }

  const preco = toDecimal(precoVendaRaw)
  const minima = toDecimal(margemOverrideRaw) ?? toDecimal(margemMinimaGlobal) ?? new Decimal(30)

  let blocoMargem: React.ReactNode = null
  let precoAbaixoDoCusto = false
  if (custo === null) {
    blocoMargem = <p className="text-sm text-muted-foreground">custo incompleto</p>
  } else if (preco !== null) {
    if (preco.lessThan(custo)) {
      precoAbaixoDoCusto = true
      blocoMargem = (
        <Alert variant="destructive">
          <AlertDescription>
            Esse preço tá abaixo do custo ({currency.format(custo.toNumber())}) — você pagaria pra vender. Aumenta o preço pra salvar.
          </AlertDescription>
        </Alert>
      )
    } else {
      const margem = margemPercent(preco, custo)
      const abaixoDoMinimo = margem.lessThan(minima)
      const lucro = preco.minus(custo)
      if (abaixoDoMinimo) {
        blocoMargem = (
          <div className="space-y-1 rounded-lg border-l-4 border-destructive bg-card p-3">
            <p className="flex items-center gap-1.5 text-base text-destructive">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              Margem abaixo do mínimo ({minima.toFixed(0)}%): de cada R$ 10 vendidos, menos de R$ 3
              ficam com você. Vale subir o preço ou rever a receita.
            </p>
          </div>
        )
      } else {
        blocoMargem = (
          <div className="space-y-1 rounded-lg border border-border bg-card p-3">
            <p className="tabular-nums text-base">
              Custa {currency.format(custo.toNumber())} pra fazer hoje. Vendendo a{' '}
              {currency.format(preco.toNumber())}, ficam {currency.format(lucro.toNumber())} com
              você ({margem.toFixed(0)}% de margem).
            </p>
            <p className="text-xs text-muted-foreground">
              Margem = quanto do preço fica com você, já descontado o custo.
            </p>
          </div>
        )
      }
    }
  }

  function onSubmit(data: ProdutoFormValues) {
    setServerError(null)
    const payload = {
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      tipo: data.tipo,
      precoVenda: data.precoVenda,
      margemMinimaOverride: data.margemMinimaOverride,
      receitaId: data.tipo === 'UNITARIO' ? data.receitaId : undefined,
      recheioReceitaId: data.tipo === 'UNITARIO' ? data.recheioReceitaId || undefined : undefined,
      kitItens:
        data.tipo === 'KIT'
          ? data.kitItens.map((i) => ({ componenteId: i.componenteId, qtde: Number(i.qtde) || 1 }))
          : undefined,
    }
    startTransition(async () => {
      const res = defaults ? await editarProduto(defaults.id, payload) : await criarProduto(payload)
      if (res?.error) {
        setServerError(res.error)
        return
      }
      router.push('/admin/produtos')
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
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SuggestInput
          id="categoria"
          label="Categoria"
          value={categoria}
          onChange={(v) => setValue('categoria', v)}
          fetchSuggestions={sugestoesCategoria}
        />

        <FormField
          control={control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>É doce único ou kit?</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="UNITARIO">Doce único</SelectItem>
                  <SelectItem value="KIT">Kit</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {tipo === 'UNITARIO' && (
          <>
            <FormField
              control={control}
              name="receitaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receita</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Escolhe a receita" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {receitas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="recheioReceitaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recheio (opcional) — se esse doce tiver</FormLabel>
                  <Select
                    value={field.value || 'nenhum'}
                    onValueChange={(v) => field.onChange(v === 'nenhum' ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sem recheio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem recheio</SelectItem>
                      {recheios
                        .filter((r) => r.id !== receitaId)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {tipo === 'KIT' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Itens do kit</h2>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-border p-3">
                <div className="flex-1 space-y-1.5">
                  <FormField
                    control={control}
                    name={`kitItens.${index}.componenteId`}
                    render={({ field: compField }) => (
                      <FormItem>
                        <FormLabel>Componente</FormLabel>
                        <Select value={compField.value} onValueChange={compField.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Escolhe um doce único" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitarios.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <FormField
                    control={control}
                    name={`kitItens.${index}.qtde`}
                    render={({ field: qtdeField }) => (
                      <FormItem>
                        <FormLabel>Qtde</FormLabel>
                        <FormControl>
                          <Input {...qtdeField} inputMode="numeric" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0"
                  aria-label="Remover item do kit"
                  onClick={() => remove(index)}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => append({ componenteId: '', qtde: '1' })}
            >
              Mais um item
            </Button>
          </div>
        )}

        <FormField
          control={control}
          name="precoVenda"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço de venda (R$)</FormLabel>
              <FormControl>
                <Input {...field} inputMode="decimal" placeholder="0,00" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {blocoMargem}

        <FormField
          control={control}
          name="margemMinimaOverride"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Margem mínima só desse produto (%) — se quiser diferente do padrão</FormLabel>
              <FormControl>
                <Input {...field} inputMode="decimal" placeholder={margemMinimaGlobal} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto w-full max-w-md">
            <Button type="submit" size="lg" className="w-full" disabled={pending || precoAbaixoDoCusto}>
              {pending ? 'Salvando...' : 'Salvar produto'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
