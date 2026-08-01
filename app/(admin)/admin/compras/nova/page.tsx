import { prisma } from '@/lib/db/client'
import { MercadoFlow } from '@/components/admin/mercado-flow'

export default async function FuiAoMercadoPage() {
  const ingredientes = await prisma.ingrediente.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, unidadeBase: true },
  })

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold">Fui ao mercado</h1>
      <MercadoFlow ingredientes={ingredientes} />
    </div>
  )
}
