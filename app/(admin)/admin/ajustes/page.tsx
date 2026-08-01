import { prisma } from '@/lib/db/client'
import { AjustesForm } from '@/components/admin/ajustes-form'

export default async function AjustesPage() {
  const config = await prisma.configuracao.findUnique({ where: { id: 1 } })
  const margemAtual = config ? config.margemMinimaPadrao.toFixed(2) : '30.00'

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Ajustes</h1>
      <AjustesForm margemAtual={margemAtual} />
    </div>
  )
}
