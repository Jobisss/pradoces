import { IngredienteForm } from '@/components/admin/ingrediente-form'

export default function NovoIngredientePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Novo ingrediente</h1>
      <IngredienteForm />
    </div>
  )
}
