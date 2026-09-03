import 'server-only'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { custoCorrenteVariacao, margensCorrentesBatch } from '@/lib/custo/corrente'
import { pontosDeResgate } from '@/lib/pontos/calculo'

/**
 * Preço em pontos dos itens de resgate, DERIVADO do custo corrente.
 *
 * `ItemResgatavel.custoPontos` continua existindo na tabela, mas só vale pra
 * item `nomeCustom` (que não tem produto no catálogo, logo não tem custo pra
 * ancorar). Pra item ligado a uma variação, o preço sai da conta e acompanha
 * o ingrediente — se o leite condensado sobe, o brigadeiro fica mais caro em
 * pontos no mesmo dia. Foi decisão explícita do dono: o preço acompanha.
 *
 * Item com custo incompleto (algum ingrediente sem compra registrada) NÃO
 * ganha preço: sem custo real, qualquer número em pontos seria invenção. Some
 * do catálogo público até a compra ser registrada.
 */
export type PrecoResgate = {
  /** null quando o custo está incompleto — o item não pode ser ofertado. */
  pontos: number | null
  custoCorrente: Decimal | null
}

type ConfigPontos = { pontosDevolucaoPercent: Decimal; pontosPorReal: Decimal }

const PADRAO: ConfigPontos = {
  pontosDevolucaoPercent: new Decimal(15),
  pontosPorReal: new Decimal(1),
}

async function configPontos(): Promise<ConfigPontos> {
  const config = await prisma.configuracao.findUnique({
    where: { id: 1 },
    select: { pontosDevolucaoPercent: true, pontosPorReal: true },
  })
  if (!config) return PADRAO
  return {
    pontosDevolucaoPercent: new Decimal(config.pontosDevolucaoPercent.toString()),
    pontosPorReal: new Decimal(config.pontosPorReal.toString()),
  }
}

/**
 * Preço de TODOS os itens de catálogo de uma vez, indexado por variacaoId.
 * Um `margensCorrentesBatch` só — a alternativa era um custoCorrenteVariacao
 * por item, que é N+1 em cima de query pesada.
 */
export async function precosDeResgateBatch(): Promise<Map<string, PrecoResgate>> {
  const [config, margens] = await Promise.all([configPontos(), margensCorrentesBatch()])

  const mapa = new Map<string, PrecoResgate>()
  for (const linha of margens) {
    if (!linha.variacaoId) continue
    mapa.set(linha.variacaoId, {
      custoCorrente: linha.custo,
      pontos:
        linha.custo === null
          ? null
          : pontosDeResgate(linha.custo, config.pontosDevolucaoPercent, config.pontosPorReal),
    })
  }
  return mapa
}

/**
 * Preço de UM item — usado na hora do resgate, onde cobrar o número certo
 * importa mais que economizar query. Fora da transação de propósito: é uma
 * leitura de precificação, não parte da invariante atômica do resgate.
 */
export async function precoDeResgateDaVariacao(variacaoId: string): Promise<PrecoResgate> {
  const [config, { custo, faltamCompras }] = await Promise.all([
    configPontos(),
    custoCorrenteVariacao(variacaoId),
  ])
  if (faltamCompras.length > 0) return { pontos: null, custoCorrente: null }
  return {
    custoCorrente: custo,
    pontos: pontosDeResgate(custo, config.pontosDevolucaoPercent, config.pontosPorReal),
  }
}
