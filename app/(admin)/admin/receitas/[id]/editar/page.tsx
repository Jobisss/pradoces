import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { ultimasCompras } from '@/lib/custo/corrente'
import { ReceitaForm } from '@/components/admin/receita-form'

export default async function EditarReceitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const receita = await prisma.receita.findUnique({
    where: { id },
    include: { itens: true },
  })
  if (!receita) notFound()

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
      <h1 className="font-display text-3xl font-semibold">Editar receita</h1>
      <ReceitaForm
        ingredientes={ingredientesProps}
        defaults={{
          id: receita.id,
          nome: receita.nome,
          rendimentoPadrao: receita.rendimentoPadrao,
          custoGas: receita.custoGas ? receita.custoGas.toFixed(4) : null,
          validadeDias: receita.validadeDias,
          itens: receita.itens.map((item) => ({
            ingredienteId: item.ingredienteId,
            qtde: item.qtde.toFixed(3),
          })),
        }}
      />
    </div>
  )
}
