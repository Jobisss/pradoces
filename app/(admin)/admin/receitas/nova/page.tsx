import { prisma } from '@/lib/db/client'
import { ultimasCompras } from '@/lib/custo/corrente'
import { ReceitaForm } from '@/components/admin/receita-form'
import { PageHeader } from '@/components/admin/ui'

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
    <div className="space-y-6">
      <PageHeader
        title="Nova receita"
        subtitle="A receita diz quanto de cada ingrediente vai num lote — é com ela que sai o custo de cada doce"
      />
      <ReceitaForm ingredientes={ingredientesProps} />
    </div>
  )
}
