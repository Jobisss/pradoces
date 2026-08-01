'use client'

import { useActionState } from 'react'
import { criarIngrediente, editarIngrediente, type IngredienteActionState } from '@/lib/actions/ingredientes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const initialState: IngredienteActionState = {}

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

  return (
    <form action={formAction} className="mx-auto w-full max-w-md space-y-6" noValidate>
      {state.error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={defaults?.nome} required />
        {fieldErrors.nome && <p className="text-sm text-muted-foreground">{fieldErrors.nome[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="unidadeBase">Como você mede</Label>
        {defaults?.travarUnidade ? (
          <>
            <p className="text-base">
              {{ g: 'gramas (g)', ml: 'mililitros (ml)', un: 'unidade (un)' }[defaults.unidadeBase]}
            </p>
            <input type="hidden" name="unidadeBase" value={defaults.unidadeBase} />
            <p className="text-sm text-muted-foreground">
              Esse ingrediente já tem compras registradas — a unidade não pode mais mudar.
            </p>
          </>
        ) : (
          <Select name="unidadeBase" defaultValue={defaults?.unidadeBase}>
            <SelectTrigger id="unidadeBase" className="w-full">
              <SelectValue placeholder="Escolhe uma unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">gramas (g)</SelectItem>
              <SelectItem value="ml">mililitros (ml)</SelectItem>
              <SelectItem value="un">unidade (un)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tipo">É ingrediente ou embalagem?</Label>
        <Select name="tipo" defaultValue={defaults?.tipo ?? 'INGREDIENTE'}>
          <SelectTrigger id="tipo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INGREDIENTE">Ingrediente</SelectItem>
            <SelectItem value="EMBALAGEM">Embalagem (forminha, caixa, fita...)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar ingrediente'}
      </Button>
    </form>
  )
}
