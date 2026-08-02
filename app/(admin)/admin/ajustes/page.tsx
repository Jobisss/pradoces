import { prisma } from '@/lib/db/client'
import { AjustesForm } from '@/components/admin/ajustes-form'
import { SimuladorPontos } from '@/components/admin/simulador-pontos'

export default async function AjustesPage() {
  const config = await prisma.configuracao.findUnique({ where: { id: 1 } })
  const margemAtual = config ? config.margemMinimaPadrao.toFixed(2) : '30.00'
  const pontosPorRealAtual = config ? config.pontosPorReal.toFixed(2) : '1.00'
  const pontosCapAtual = String(config?.pontosCapPorReserva ?? 500)
  const pontosExpiracaoAtual = String(config?.pontosExpiracaoMeses ?? 12)
  const janelaCancelamentoAtual = String(config?.janelaCancelamentoHoras ?? 24)

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">Ajustes</h1>
      <AjustesForm
        margemAtual={margemAtual}
        pontosPorRealAtual={pontosPorRealAtual}
        pontosCapAtual={pontosCapAtual}
        pontosExpiracaoAtual={pontosExpiracaoAtual}
        janelaCancelamentoAtual={janelaCancelamentoAtual}
      />
      <SimuladorPontos pontosPorRealAtual={pontosPorRealAtual} capAtual={pontosCapAtual} />
    </div>
  )
}
