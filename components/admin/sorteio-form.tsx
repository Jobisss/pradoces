'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { criarSorteio, editarSorteio } from '@/lib/actions/sorteios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

type FormValues = {
  nome: string
  premio: string
  custoPontos: string
  capPorCliente: string
  prazo: string
}

type SorteioFormProps = {
  defaults?: {
    id: string
    nome: string
    premio: string
    custoPontos: number
    capPorCliente: number
    prazo: string // ISO
  }
}

/** SORT-01/02. */
export function SorteioForm({ defaults }: SorteioFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    defaultValues: {
      nome: defaults?.nome ?? '',
      premio: defaults?.premio ?? '',
      custoPontos: defaults ? String(defaults.custoPontos) : '',
      capPorCliente: defaults ? String(defaults.capPorCliente) : '10',
      // datetime-local espera "YYYY-MM-DDTHH:mm" sem timezone.
      prazo: defaults ? defaults.prazo.slice(0, 16) : '',
    },
  })
  const { control, handleSubmit } = form

  function onSubmit(data: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const res = defaults ? await editarSorteio(defaults.id, data) : await criarSorteio(data)
      if (res?.error) {
        setServerError(res.error)
        return
      }
      router.push('/admin/sorteios')
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
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do sorteio</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="premio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prêmio</FormLabel>
              <FormControl>
                <Textarea {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="custoPontos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custo por chance (pontos)</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="capPorCliente"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Máximo de chances por cliente</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="prazo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Encerra em</FormLabel>
              <FormControl>
                <Input {...field} type="datetime-local" required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar sorteio'}
        </Button>
      </form>
    </Form>
  )
}
