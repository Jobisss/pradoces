import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { ItemResgatavelForm } from '@/components/admin/item-resgatavel-form'

export default async function EditarItemResgatavelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [item, produtos] = await Promise.all([
    prisma.itemResgatavel.findUnique({ where: { id } }),
    prisma.produto.findMany({
      where: { ativo: true, tipo: 'UNITARIO' },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])
  if (!item) notFound()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Editar item de resgate</h1>
      <ItemResgatavelForm
        produtos={produtos}
        defaults={{
          id: item.id,
          produtoId: item.produtoId,
          nomeCustom: item.nomeCustom,
          custoPontos: item.custoPontos,
          ativo: item.ativo,
        }}
      />
    </div>
  )
}
