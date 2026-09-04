import { prisma } from '@/lib/db/client'
import { AjustesForm } from '@/components/admin/ajustes-form'
import { SimuladorPontos } from '@/components/admin/simulador-pontos'
import { PageHeader } from '@/components/admin/ui'

export default async function AjustesPage() {
  const config = await prisma.configuracao.findUnique({ where: { id: 1 } })
  const margemAtual = config ? config.margemMinimaPadrao.toFixed(2) : '30.00'
  const pontosPorRealAtual = config ? config.pontosPorReal.toFixed(2) : '1.00'
  const devolucaoAtual = config ? config.pontosDevolucaoPercent.toFixed(2) : '15.00'
  const valorHoraAtual = config ? config.valorHoraMaoDeObra.toFixed(2) : '0.00'
  const metaAtual = config ? config.metaLucroMensal.toFixed(2) : '0.00'
  const lucroHoraAtual = config ? config.lucroPorHoraAlvo.toFixed(2) : '0.00'
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
    <div className="space-y-6">
      <PageHeader
        title="Ajustes"
        subtitle="Regras que valem pro site inteiro — mexer aqui muda o comportamento de todas as telas"
      />
      <AjustesForm
        margemAtual={margemAtual}
        pontosPorRealAtual={pontosPorRealAtual}
        devolucaoAtual={devolucaoAtual}
        valorHoraAtual={valorHoraAtual}
        metaAtual={metaAtual}
        lucroHoraAtual={lucroHoraAtual}
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
      <SimuladorPontos devolucaoAtual={devolucaoAtual} />
    </div>
  )
}
