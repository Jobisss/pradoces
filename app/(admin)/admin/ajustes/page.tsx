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
  const taxaEntregaAtual = config ? config.taxaEntregaPadrao.toFixed(2) : '0.00'
  const entregaAtivaAtual = config?.entregaAtiva ?? false
  const pixAtivoAtual = config?.pixAtivo ?? false
  const pixTipoChaveAtual = config?.pixTipoChave ?? ''
  const pixChaveAtual = config?.pixChave ?? ''
  const pixNomeBeneficiarioAtual = config?.pixNomeBeneficiario ?? ''
  const pixCidadeAtual = config?.pixCidade ?? ''

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">Ajustes</h1>
      <AjustesForm
        margemAtual={margemAtual}
        pontosPorRealAtual={pontosPorRealAtual}
        pontosCapAtual={pontosCapAtual}
        pontosExpiracaoAtual={pontosExpiracaoAtual}
        janelaCancelamentoAtual={janelaCancelamentoAtual}
        taxaEntregaAtual={taxaEntregaAtual}
        entregaAtivaAtual={entregaAtivaAtual}
        pixAtivoAtual={pixAtivoAtual}
        pixTipoChaveAtual={pixTipoChaveAtual}
        pixChaveAtual={pixChaveAtual}
        pixNomeBeneficiarioAtual={pixNomeBeneficiarioAtual}
        pixCidadeAtual={pixCidadeAtual}
      />
      <SimuladorPontos pontosPorRealAtual={pontosPorRealAtual} capAtual={pontosCapAtual} />
    </div>
  )
}
