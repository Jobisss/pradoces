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

type VariacaoOpcao = { id: string; nome: string; precoVenda: number | null }
type ProdutoOpcao = { id: string; nome: string; variacoes: VariacaoOpcao[] }

type FormValues = {
  modo: 'produto' | 'custom'
  produtoId: string
  variacaoId: string
  nomeCustom: string
  custoPontos: string
  ativo: boolean
}

type ItemResgatavelFormProps = {
  produtos: ProdutoOpcao[]
  defaults?: {
    id: string
    produtoId: string | null
    variacaoId: string | null
    nomeCustom: string | null
    custoPontos: number
    ativo: boolean
  }
}

/** RESG-01/02/07 — produto do catálogo OU nome custom, nunca os dois. D-13: quando é produto, a variação (sabor) é obrigatória. */
export function ItemResgatavelForm({ produtos, defaults }: ItemResgatavelFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    defaultValues: {
      modo: defaults?.nomeCustom ? 'custom' : 'produto',
      produtoId: defaults?.produtoId ?? '',
      variacaoId: defaults?.variacaoId ?? '',
      nomeCustom: defaults?.nomeCustom ?? '',
      custoPontos: defaults ? String(defaults.custoPontos) : '',
      ativo: defaults?.ativo ?? true,
    },
  })
  const { control, handleSubmit, watch, setValue } = form
  const modo = watch('modo')
  const produtoId = watch('produtoId')
  const produtoSelecionado = modo === 'produto' ? produtos.find((p) => p.id === produtoId) : undefined

  function onSubmit(data: FormValues) {
    setServerError(null)
    const payload = {
      produtoId: data.modo === 'produto' ? data.produtoId : undefined,
      variacaoId: data.modo === 'produto' ? data.variacaoId : undefined,
      nomeCustom: data.modo === 'custom' ? data.nomeCustom : undefined,
      // Item ligado a um produto tem preço em pontos DERIVADO do custo
      // corrente (lib/pontos/resgate.ts) — a coluna não é lida nesse caso.
      // Manda 1 só pra satisfazer o schema, que exige >= 1.
      custoPontos: data.modo === 'produto' ? '1' : data.custoPontos,
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
          <>
            <FormField
              control={control}
              name="produtoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      const opcoes = produtos.find((p) => p.id === v)?.variacoes ?? []
                      setValue('variacaoId', opcoes.length === 1 ? opcoes[0].id : '')
                    }}
                  >
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

            <FormField
              control={control}
              name="variacaoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qual variação (sabor)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={produtoSelecionado ? 'Escolhe a variação' : 'Escolhe o produto primeiro'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(produtoSelecionado?.variacoes ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
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

        {modo === 'produto' && (
          <div className="space-y-1 rounded-xl bg-background p-4">
            <p className="text-sm font-semibold">O preço em pontos é calculado</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              Sai do custo atual do doce dividido pela devolução configurada em Ajustes — e
              acompanha o ingrediente: se o leite condensado sobe, o item fica mais caro em pontos
              no mesmo dia. Você não precisa (nem consegue) digitar esse número aqui.
            </p>
          </div>
        )}

        {modo === 'custom' && (
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
