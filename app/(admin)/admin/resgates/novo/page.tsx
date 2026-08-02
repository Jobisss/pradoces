import { prisma } from '@/lib/db/client'
import { ItemResgatavelForm } from '@/components/admin/item-resgatavel-form'

export default async function NovoItemResgatavelPage() {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, tipo: 'UNITARIO' },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Novo item de resgate</h1>
      <ItemResgatavelForm produtos={produtos} />
    </div>
  )
}
