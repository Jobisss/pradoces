import { prisma } from '@/lib/db/client'
import { ultimasCompras } from '@/lib/custo/corrente'
import { ReceitaForm } from '@/components/admin/receita-form'

export default async function NovaReceitaPage() {
  const ingredientes = await prisma.ingrediente.findMany({ orderBy: { nome: 'asc' } })
  const ultimas = await ultimasCompras(ingredientes.map((i) => i.id))

  const ingredientesProps = ingredientes.map((i) => ({
    id: i.id,
    nome: i.nome,
    unidadeBase: i.unidadeBase,
    custoPorUnidadeBase: ultimas.get(i.id)?.custoPorUnidadeBase.toFixed(6) ?? null,
  }))

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold">Nova receita</h1>
      <ReceitaForm ingredientes={ingredientesProps} />
    </div>
  )
}
