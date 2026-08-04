'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarItemResgatavel, editarItemResgatavel } from '@/lib/actions/itens-resgataveis'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'

type Produto = { id: string; nome: string; precoVenda: number | null; margem: number | null }

type FormValues = {
  modo: 'produto' | 'custom'
  produtoId: string
  nomeCustom: string
  custoPontos: string
  ativo: boolean
}

type ItemResgatavelFormProps = {
  produtos: Produto[]
  pontosPorRealAtual: number
  defaults?: {
    id: string
    produtoId: string | null
    nomeCustom: string | null
    custoPontos: number
    ativo: boolean
  }
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** RESG-01/02/07 — produto do catálogo OU nome custom, nunca os dois. */
export function ItemResgatavelForm({ produtos, pontosPorRealAtual, defaults }: ItemResgatavelFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    defaultValues: {
      modo: defaults?.nomeCustom ? 'custom' : 'produto',
      produtoId: defaults?.produtoId ?? '',
      nomeCustom: defaults?.nomeCustom ?? '',
      custoPontos: defaults ? String(defaults.custoPontos) : '',
      ativo: defaults?.ativo ?? true,
    },
  })
  const { control, handleSubmit, watch, setValue } = form
  const modo = watch('modo')
  const produtoId = watch('produtoId')
  const custoPontosStr = watch('custoPontos')

  const produtoSelecionado = modo === 'produto' ? produtos.find((p) => p.id === produtoId) : undefined
  const custoPontosNum = Number(custoPontosStr?.replace(',', '.'))

  let dica: { valorPorPonto: number; cashbackPercent: number; arriscado: boolean; sugestao: number } | null = null
  if (
    produtoSelecionado &&
    produtoSelecionado.precoVenda !== null &&
    produtoSelecionado.margem !== null &&
    produtoSelecionado.margem > 0 &&
    Number.isFinite(custoPontosNum) &&
    custoPontosNum > 0
  ) {
    const valorPorPonto = produtoSelecionado.precoVenda / custoPontosNum
    const cashbackPercent = valorPorPonto * pontosPorRealAtual * 100
    // Sugestão: custoPontos que deixa o cashback em metade da margem (folga).
    const sugestao = Math.ceil((produtoSelecionado.precoVenda * pontosPorRealAtual * 200) / produtoSelecionado.margem)
    dica = { valorPorPonto, cashbackPercent, arriscado: cashbackPercent >= produtoSelecionado.margem, sugestao }
  }

  function onSubmit(data: FormValues) {
    setServerError(null)
    const payload = {
      produtoId: data.modo === 'produto' ? data.produtoId : undefined,
      nomeCustom: data.modo === 'custom' ? data.nomeCustom : undefined,
      custoPontos: data.custoPontos,
      ativo: data.ativo,
    }
    startTransition(async () => {
      const res = defaults ? await editarItemResgatavel(defaults.id, payload) : await criarItemResgatavel(payload)
      if (res?.error) {
        setServerError(res.error)
        return
      }
      router.push('/admin/resgates')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-6" noValidate>
        {serverError && (
          <p role="alert" className="text-sm text-muted-foreground">
            {serverError}
          </p>
        )}

        <FormField
          control={control}
          name="modo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>O que vai ser trocado?</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="produto">Um produto do catálogo</SelectItem>
                  <SelectItem value="custom">Outra coisa (nome livre)</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {modo === 'produto' ? (
          <FormField
            control={control}
            name="produtoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produto</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolhe o produto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={control}
            name="nomeCustom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do prêmio</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex.: Caneca personalizada" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={control}
          name="custoPontos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custo em pontos</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {modo === 'produto' && produtoSelecionado && (produtoSelecionado.precoVenda === null || produtoSelecionado.margem === null) && (
          <p className="text-sm text-muted-foreground">
            Esse produto ainda não tem custo calculado (falta compra de ingrediente registrada) — sem
            referência de margem pra sugerir um valor seguro.
          </p>
        )}

        {dica && (
          <div
            className={`space-y-1 rounded-lg border p-3 text-sm ${
              dica.arriscado ? 'border-destructive text-destructive' : 'border-border text-muted-foreground'
            }`}
          >
            <p>
              Isso equivale a ~{currency.format(dica.valorPorPonto)} por ponto — ~{dica.cashbackPercent.toFixed(1)}%
              de cashback sobre o preço de venda, contra {produtoSelecionado!.margem!.toFixed(1)}% de margem desse
              produto.
            </p>
            <p className={dica.arriscado ? 'font-medium' : ''}>
              {dica.arriscado
                ? 'Igual ou acima da margem — resgatar esse item dá prejuízo.'
                : 'Dentro da margem, com folga pra não sair no prejuízo.'}
            </p>
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => setValue('custoPontos', String(dica!.sugestao))}
            >
              Usar sugestão com folga: {dica.sugestao} pontos
            </button>
          </div>
        )}

        <FormField
          control={control}
          name="ativo"
          render={({ field }) => (
            <FormItem className="group/field flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal">Ativo (aparece pro cliente trocar)</FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar item'}
        </Button>
      </form>
    </Form>
  )
}
