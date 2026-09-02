import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'

/**
 * O pedaço da Configuracao que a vitrine pública pode mostrar.
 *
 * A faixa de fidelidade da home promete "cada real vira N pontos, valem M
 * meses" — os dois números são editáveis pela mãe em Ajustes, então escrever
 * qualquer um deles na mão no JSX transforma a home numa promessa que pode
 * ficar mentirosa no dia em que ela mexer na taxa. Por isso lê daqui.
 *
 * `select` explícito de propósito: o resto de Configuracao (margem mínima,
 * chave Pix, dados do beneficiário) é da mãe e não tem por que trafegar
 * pra uma página pública.
 */
export type ConfigPublica = {
  pontosPorReal: string
  pontosExpiracaoMeses: number
  /**
   * Os dois nascem `false` no schema e só ligam depois que a mãe configurar
   * taxa e chave em Ajustes. A home NUNCA pode anunciar entrega ou Pix sem
   * consultar isto — seria prometer serviço que não existe.
   */
  entregaAtiva: boolean
  pixAtivo: boolean
}

export async function configPublica(): Promise<ConfigPublica> {
  const config = await prisma.configuracao.findUnique({
    where: { id: 1 },
    select: {
      pontosPorReal: true,
      pontosExpiracaoMeses: true,
      entregaAtiva: true,
      pixAtivo: true,
    },
  })
  // Banco recém-criado ainda não tem a linha 1 — usa os mesmos defaults do
  // schema em vez de sumir com a faixa (ver prisma/schema.prisma).
  return {
    pontosPorReal: (config?.pontosPorReal ?? new Decimal(1)).toFixed(2),
    pontosExpiracaoMeses: config?.pontosExpiracaoMeses ?? 12,
    // Default conservador: sem linha de config, assume desligado — errar pro
    // lado de não prometer.
    entregaAtiva: config?.entregaAtiva ?? false,
    pixAtivo: config?.pixAtivo ?? false,
  }
}
