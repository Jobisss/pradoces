import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { IngredienteForm } from '@/components/admin/ingrediente-form'

export default async function EditarIngredientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ingrediente = await prisma.ingrediente.findUnique({
    where: { id },
    include: { _count: { select: { compras: true } } },
  })
  if (!ingrediente) notFound()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Editar ingrediente</h1>
      <IngredienteForm
        defaults={{
          id: ingrediente.id,
          nome: ingrediente.nome,
          unidadeBase: ingrediente.unidadeBase,
          tipo: ingrediente.tipo,
          travarUnidade: ingrediente._count.compras > 0,
        }}
      />
    </div>
  )
}
