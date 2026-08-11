'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { custoCorrenteReceita, custoCorrenteRecheio, custoCorrenteVariacao } from '@/lib/custo/corrente'
import { ProdutoSchema, type ProdutoInput, type VariacaoInput } from '@/lib/validation/produtos'
import { CAMPANHAS } from '@/lib/campanhas/definicoes'

/**
 * Produto (PROD-01/02/08/09), admin-only. PROD-09 é o requisito de segurança
 * de negócio da fase: o preço nunca pode ficar abaixo do custo, e essa regra
 * é recomputada aqui a partir das rows FK'adas — o client manda só
 * IDs+preço, nunca o custo. D-13: preço/custo de UNITARIO são validados POR
 * VARIAÇÃO (cada uma pode ter recheio/preço diferentes); KIT continua com um
 * preço só, agora somando o custo de cada componente pela Variação específica
 * escolhida (não "qualquer sabor").
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const KIT_COMPONENTE_INVALIDO = 'Um dos itens do kit não é uma variação válida de um doce único.'

export type ProdutoActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const ua = h.get('user-agent') ?? undefined
  return { ip, ua }
}

function precoAbaixoDoCustoCopy(custo: Decimal): string {
  const formatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    custo.toNumber(),
  )
  return `Esse preço tá abaixo do custo (${formatado}) — você pagaria pra vender. Aumenta o preço pra salvar.`
}

/**
 * Custo do que está sendo SALVO pra uma Variação (não o que já existe no
 * DB) — receita base indicada + recheio quando houver, rateado por grama
 * (custoCorrenteRecheio — regra de 3 sobre recheioGramasUsadas). Retorna
 * custo=null quando não há base pra comparar (nenhuma compra registrada).
 */
async function custoParaSalvarVariacao(
  receitaId: string,
  recheioReceitaId?: string,
  recheioGramasUsadas?: Decimal,
): Promise<{ custo: Decimal | null }> {
  const { porUnidade, faltamCompras } = await custoCorrenteReceita(receitaId)
  const receita = await prisma.receita.findUnique({
    where: { id: receitaId },
    select: { itens: { select: { ingredienteId: true } } },
  })
  const semNenhumaCompra = !!receita && receita.itens.length > 0 && faltamCompras.length === receita.itens.length
  if (semNenhumaCompra) return { custo: null }

  if (!recheioReceitaId || !recheioGramasUsadas) return { custo: porUnidade }
  const recheio = await custoCorrenteRecheio(recheioReceitaId, recheioGramasUsadas)
  return { custo: porUnidade.plus(recheio.custoParaProduto) }
}

/**
 * Custo do KIT que está sendo salvo — soma custoCorrenteVariacao de cada
 * componente × qtde (D-13: cada item de kit aponta pra uma Variação
 * específica, não "qualquer sabor"). Confere que o componente é mesmo
 * UNITARIO e que a variação escolhida é mesmo dele (integridade — evita um
 * payload malformado misturar variação de outro produto).
 */
async function custoParaSalvarKit(
  kitItens: { componenteId: string; componenteVariacaoId: string; qtde: number }[],
): Promise<{ custo: Decimal | null; erroKit?: string }> {
  const componentes = await prisma.produto.findMany({
    where: { id: { in: kitItens.map((i) => i.componenteId) } },
    select: { id: true, tipo: true },
  })
  const componentePorId = new Map(componentes.map((c) => [c.id, c]))

  const variacoes = await prisma.variacao.findMany({
    where: { id: { in: kitItens.map((i) => i.componenteVariacaoId) } },
    select: { id: true, produtoId: true },
  })
  const variacaoPorId = new Map(variacoes.map((v) => [v.id, v]))

  let custo = new Decimal(0)
  let algumEncontrado = false
  for (const item of kitItens) {
    const componente = componentePorId.get(item.componenteId)
    const variacao = variacaoPorId.get(item.componenteVariacaoId)
    if (!componente || componente.tipo !== 'UNITARIO' || !variacao || variacao.produtoId !== componente.id) {
      return { custo: null, erroKit: KIT_COMPONENTE_INVALIDO }
    }
    const { custo: custoVariacao } = await custoCorrenteVariacao(item.componenteVariacaoId)
    algumEncontrado = true
    custo = custo.plus(custoVariacao.times(item.qtde))
  }
  return { custo: algumEncontrado ? custo : null }
}

/** PROD-09 pra UNITARIO: cada Variação é checada contra o SEU próprio custo — tudo ou nada. */
async function validarPrecosVariacoes(
  receitaId: string,
  variacoes: VariacaoInput[],
): Promise<{ error?: string }> {
  for (const v of variacoes) {
    const { custo } = await custoParaSalvarVariacao(receitaId, v.recheioReceitaId, v.recheioGramasUsadas)
    if (custo && v.precoVenda.lessThan(custo)) {
      return { error: `${v.nome}: ${precoAbaixoDoCustoCopy(custo)}` }
    }
  }
  return {}
}

function variacaoCreateData(v: VariacaoInput) {
  return {
    nome: v.nome,
    recheioReceitaId: v.recheioReceitaId ?? null,
    recheioGramasUsadas: v.recheioGramasUsadas ? v.recheioGramasUsadas.toFixed(3) : null,
    precoVenda: v.precoVenda.toFixed(4),
    margemMinimaOverride: v.margemMinimaOverride ? v.margemMinimaOverride.toFixed(2) : null,
    ativo: v.ativo,
  }
}

export async function criarProduto(input: unknown): Promise<ProdutoActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ProdutoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  if (parsed.data.tipo === 'UNITARIO') {
    const { error } = await validarPrecosVariacoes(parsed.data.receitaId!, parsed.data.variacoes!)
    if (error) return { error }
  } else {
    const { custo, erroKit } = await custoParaSalvarKit(parsed.data.kitItens!)
    if (erroKit) return { error: erroKit }
    if (custo && parsed.data.precoVenda!.lessThan(custo)) {
      return { error: precoAbaixoDoCustoCopy(custo) }
    }
  }

  const campanhaIdsValidos = new Set(CAMPANHAS.map((c) => c.id))
  const campanhas = parsed.data.campanhas.filter((c) => campanhaIdsValidos.has(c as (typeof CAMPANHAS)[number]['id']))

  let produto: { id: string }
  try {
    produto = await prisma.produto.create({
      data: {
        nome: parsed.data.nome,
        descricao: parsed.data.descricao,
        categoria: parsed.data.categoria,
        tipo: parsed.data.tipo,
        ativo: parsed.data.ativo,
        alergenicos: parsed.data.alergenicos,
        precoVenda: parsed.data.tipo === 'KIT' ? parsed.data.precoVenda!.toFixed(4) : null,
        margemMinimaOverride:
          parsed.data.tipo === 'KIT' && parsed.data.margemMinimaOverride
            ? parsed.data.margemMinimaOverride.toFixed(2)
            : null,
        receitaId: parsed.data.tipo === 'UNITARIO' ? parsed.data.receitaId : null,
        variacoes:
          parsed.data.tipo === 'UNITARIO' && parsed.data.variacoes
            ? { create: parsed.data.variacoes.map(variacaoCreateData) }
            : undefined,
        kitItens:
          parsed.data.tipo === 'KIT' && parsed.data.kitItens
            ? {
                create: parsed.data.kitItens.map((i) => ({
                  componenteId: i.componenteId,
                  componenteVariacaoId: i.componenteVariacaoId,
                  qtde: i.qtde,
                })),
              }
            : undefined,
        campanhas: campanhas.length > 0 ? { create: campanhas.map((campanhaId) => ({ campanhaId })) } : undefined,
      },
      select: { id: true },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/admin/produtos')
  revalidatePath('/')
  return { ok: true, id: produto.id }
}

export async function editarProduto(id: string, input: unknown): Promise<ProdutoActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ProdutoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  if (parsed.data.tipo === 'UNITARIO') {
    const { error } = await validarPrecosVariacoes(parsed.data.receitaId!, parsed.data.variacoes!)
    if (error) return { error }
  } else {
    const { custo, erroKit } = await custoParaSalvarKit(parsed.data.kitItens!)
    if (erroKit) return { error: erroKit }
    if (custo && parsed.data.precoVenda!.lessThan(custo)) {
      return { error: precoAbaixoDoCustoCopy(custo) }
    }
  }

  const atual = await prisma.produto.findUnique({
    where: { id },
    include: {
      variacoes: {
        select: {
          id: true,
          precoVenda: true,
          _count: { select: { lotes: true, emKits: true, itensResgataveis: true } },
        },
      },
    },
  })
  if (!atual) return { error: GENERIC_SERVER_ERROR }

  const campanhaIdsValidos = new Set(CAMPANHAS.map((c) => c.id))
  const campanhas = parsed.data.campanhas.filter((c) => campanhaIdsValidos.has(c as (typeof CAMPANHAS)[number]['id']))

  const precosAlterados: { variacaoId: string; nome: string; antes: string; depois: string }[] = []

  try {
    await prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          descricao: parsed.data.descricao,
          categoria: parsed.data.categoria,
          tipo: parsed.data.tipo,
          ativo: parsed.data.ativo,
          alergenicos: parsed.data.alergenicos,
          precoVenda: parsed.data.tipo === 'KIT' ? parsed.data.precoVenda!.toFixed(4) : null,
          margemMinimaOverride:
            parsed.data.tipo === 'KIT' && parsed.data.margemMinimaOverride
              ? parsed.data.margemMinimaOverride.toFixed(2)
              : null,
          receitaId: parsed.data.tipo === 'UNITARIO' ? parsed.data.receitaId : null,
        },
      })

      // Kit e campanhas: junções sem histórico próprio, apaga-tudo-e-recria continua ok.
      await tx.produtoKitItem.deleteMany({ where: { kitId: id } })
      await tx.campanhaProduto.deleteMany({ where: { produtoId: id } })
      if (parsed.data.tipo === 'KIT' && parsed.data.kitItens && parsed.data.kitItens.length > 0) {
        await tx.produtoKitItem.createMany({
          data: parsed.data.kitItens.map((i) => ({
            kitId: id,
            componenteId: i.componenteId,
            componenteVariacaoId: i.componenteVariacaoId,
            qtde: i.qtde,
          })),
        })
      }
      if (campanhas.length > 0) {
        await tx.campanhaProduto.createMany({ data: campanhas.map((campanhaId) => ({ campanhaId, produtoId: id })) })
      }

      // Variações: NUNCA apaga-tudo-e-recria — Lote/ProdutoKitItem/ItemResgatavel
      // apontam pra cá com onDelete: Restrict, um deleteMany bateria em
      // qualquer variação com histórico e derrubaria a transação inteira.
      // Diff de verdade: update por id, create sem id, e uma variação que
      // sumiu do payload vira ativo:false (se tem histórico) ou delete de
      // verdade (se nunca foi usada em lote/kit/resgate).
      if (parsed.data.tipo === 'UNITARIO' && parsed.data.variacoes) {
        const atuaisPorId = new Map(atual.variacoes.map((v) => [v.id, v]))
        const idsNoPayload = new Set(parsed.data.variacoes.filter((v) => v.id).map((v) => v.id!))

        for (const v of parsed.data.variacoes) {
          const data = variacaoCreateData(v)
          const existente = v.id ? atuaisPorId.get(v.id) : undefined
          if (existente) {
            if (!existente.precoVenda.equals(v.precoVenda.toDecimalPlaces(4))) {
              precosAlterados.push({
                variacaoId: existente.id,
                nome: v.nome,
                antes: existente.precoVenda.toFixed(4),
                depois: v.precoVenda.toFixed(4),
              })
            }
            await tx.variacao.update({ where: { id: existente.id }, data })
          } else {
            await tx.variacao.create({ data: { produtoId: id, ...data } })
          }
        }

        for (const existente of atual.variacoes) {
          if (idsNoPayload.has(existente.id)) continue
          const temHistorico =
            existente._count.lotes > 0 || existente._count.emKits > 0 || existente._count.itensResgataveis > 0
          if (temHistorico) {
            await tx.variacao.update({ where: { id: existente.id }, data: { ativo: false } })
          } else {
            await tx.variacao.delete({ where: { id: existente.id } })
          }
        }
      }
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (
    parsed.data.tipo === 'KIT' &&
    atual.precoVenda &&
    !atual.precoVenda.equals(parsed.data.precoVenda!.toDecimalPlaces(4))
  ) {
    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      action: 'preco_alterado',
      entityType: 'produto',
      entityId: id,
      metadata: { antes: atual.precoVenda.toFixed(4), depois: parsed.data.precoVenda!.toFixed(4) },
      rawIp: ip,
      rawUa: ua,
    })
  }
  for (const alterado of precosAlterados) {
    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      action: 'preco_alterado',
      entityType: 'variacao',
      entityId: alterado.variacaoId,
      metadata: { produtoId: id, nome: alterado.nome, antes: alterado.antes, depois: alterado.depois },
      rawIp: ip,
      rawUa: ua,
    })
  }

  revalidatePath('/admin/produtos')
  revalidatePath('/')
  return { ok: true, id }
}

export async function sugestoesCategoria(prefix: string): Promise<string[]> {
  try {
    await requireAdmin()
  } catch {
    return []
  }
  try {
    const rows = await prisma.$queryRaw<{ categoria: string }[]>`
      SELECT DISTINCT categoria FROM produtos
      WHERE categoria ILIKE ${prefix + '%'} ORDER BY categoria LIMIT 10`
    return rows.map((r) => r.categoria)
  } catch {
    return []
  }
}
