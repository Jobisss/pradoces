import { prisma } from '@/lib/db/client'
import { MercadoFlow } from '@/components/admin/mercado-flow'
import { PageHeader } from '@/components/admin/ui'

export default async function FuiAoMercadoPage() {
  const ingredientes = await prisma.ingrediente.findMany({
    orderBy: { nome: 'asc' },
    // `tipo` alimenta a quebra "ingredientes × embalagens" do total da ida.
    select: { id: true, nome: true, unidadeBase: true, tipo: true },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fui ao mercado"
        subtitle="Cada item é salvo na hora — pode fechar a aba no meio que nada se perde"
      />
      <MercadoFlow ingredientes={ingredientes} />
    </div>
  )
}
