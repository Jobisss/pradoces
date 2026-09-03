import { IngredienteForm } from '@/components/admin/ingrediente-form'
import { PageHeader } from '@/components/admin/ui'

export default function NovoIngredientePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo ingrediente"
        subtitle="Vale pra ingrediente e pra embalagem — forminha, caixa e fita entram aqui também"
      />
      <IngredienteForm />
    </div>
  )
}
