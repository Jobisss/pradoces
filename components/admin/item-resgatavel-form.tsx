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

type Produto = { id: string; nome: string }

type FormValues = {
  modo: 'produto' | 'custom'
  produtoId: string
  nomeCustom: string
  custoPontos: string
  ativo: boolean
}

type ItemResgatavelFormProps = {
  produtos: Produto[]
  defaults?: {
    id: string
    produtoId: string | null
    nomeCustom: string | null
    custoPontos: number
    ativo: boolean
  }
}

/** RESG-01/02/07 — produto do catálogo OU nome custom, nunca os dois. */
export function ItemResgatavelForm({ produtos, defaults }: ItemResgatavelFormProps) {
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
  const { control, handleSubmit, watch } = form
  const modo = watch('modo')

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
