'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { custoCorrenteReceita } from '@/lib/custo/corrente'
import { ProdutoSchema, type ProdutoInput } from '@/lib/validation/produtos'
import { CAMPANHAS } from '@/lib/campanhas/definicoes'

/**
 * Produto (PROD-01/02/08/09), admin-only. PROD-09 é o requisito de segurança
 * de negócio da fase: o preço nunca pode ficar abaixo do custo, e essa regra
 * é recomputada aqui a partir das rows FK'adas — o client manda só
 * IDs+preço, nunca o custo.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const KIT_COMPONENTE_INVALIDO = 'Um dos itens do kit não é um doce único válido.'

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
 * Custo do que está sendo SALVO (não o que já existe no DB) — UNITARIO vem
 * da receita indicada + recheio quando houver (D-12, soma direta, sem
 * escalar — rendimento do recheio já é "por unidade"), KIT soma os
 * componentes (D-11). Retorna custo=null quando não há base pra comparar
 * (nenhuma compra registrada em nada).
 */
async function custoParaSalvar(
  data: Pick<ProdutoInput, 'tipo' | 'receitaId' | 'recheioReceitaId' | 'kitItens'>,
): Promise<{ custo: Decimal | null; erroKit?: string }> {
  if (data.tipo === 'UNITARIO') {
    if (!data.receitaId) return { custo: null }
    const { porUnidade, faltamCompras } = await custoCorrenteReceita(data.receitaId)
    const receita = await prisma.receita.findUnique({
      where: { id: data.receitaId },
      select: { itens: { select: { ingredienteId: true } } },
    })
    const semNenhumaCompra =
      !!receita && receita.itens.length > 0 && faltamCompras.length === receita.itens.length
    if (semNenhumaCompra) return { custo: null }

    if (!data.recheioReceitaId) return { custo: porUnidade }
    const recheio = await custoCorrenteReceita(data.recheioReceitaId)
    return { custo: porUnidade.plus(recheio.porUnidade) }
  }

  const componentes = await prisma.produto.findMany({
    where: { id: { in: (data.kitItens ?? []).map((i) => i.componenteId) } },
    select: { id: true, tipo: true, receitaId: true },
  })
  const porId = new Map(componentes.map((c) => [c.id, c]))

  let custo = new Decimal(0)
  let algumEncontrado = false
  for (const item of data.kitItens ?? []) {
    const componente = porId.get(item.componenteId)
    if (!componente || componente.tipo !== 'UNITARIO') {
      return { custo: null, erroKit: KIT_COMPONENTE_INVALIDO }
    }
    if (!componente.receitaId) continue
    const { porUnidade } = await custoCorrenteReceita(componente.receitaId)
    algumEncontrado = true
    custo = custo.plus(porUnidade.times(item.qtde))
  }
  return { custo: algumEncontrado ? custo : null }
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

  const { custo, erroKit } = await custoParaSalvar(parsed.data)
  if (erroKit) return { error: erroKit }
  if (custo && parsed.data.precoVenda.lessThan(custo)) {
    return { error: precoAbaixoDoCustoCopy(custo) }
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
        precoVenda: parsed.data.precoVenda.toFixed(4),
        margemMinimaOverride: parsed.data.margemMinimaOverride
          ? parsed.data.margemMinimaOverride.toFixed(2)
          : null,
        receitaId: parsed.data.tipo === 'UNITARIO' ? parsed.data.receitaId : null,
        recheioReceitaId: parsed.data.tipo === 'UNITARIO' ? (parsed.data.recheioReceitaId ?? null) : null,
        kitItens:
          parsed.data.tipo === 'KIT' && parsed.data.kitItens
            ? { create: parsed.data.kitItens.map((i) => ({ componenteId: i.componenteId, qtde: i.qtde })) }
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

  const { custo, erroKit } = await custoParaSalvar(parsed.data)
  if (erroKit) return { error: erroKit }
  if (custo && parsed.data.precoVenda.lessThan(custo)) {
    return { error: precoAbaixoDoCustoCopy(custo) }
  }

  const atual = await prisma.produto.findUnique({ where: { id } })
  if (!atual) return { error: GENERIC_SERVER_ERROR }

  const campanhaIdsValidos = new Set(CAMPANHAS.map((c) => c.id))
  const campanhas = parsed.data.campanhas.filter((c) => campanhaIdsValidos.has(c as (typeof CAMPANHAS)[number]['id']))

  try {
    await prisma.$transaction([
      prisma.produtoKitItem.deleteMany({ where: { kitId: id } }),
      prisma.campanhaProduto.deleteMany({ where: { produtoId: id } }),
      prisma.produto.update({
        where: { id },
        data: {
          nome: parsed.data.nome,
          descricao: parsed.data.descricao,
          categoria: parsed.data.categoria,
          tipo: parsed.data.tipo,
          ativo: parsed.data.ativo,
          alergenicos: parsed.data.alergenicos,
          precoVenda: parsed.data.precoVenda.toFixed(4),
          margemMinimaOverride: parsed.data.margemMinimaOverride
            ? parsed.data.margemMinimaOverride.toFixed(2)
            : null,
          receitaId: parsed.data.tipo === 'UNITARIO' ? parsed.data.receitaId : null,
          recheioReceitaId: parsed.data.tipo === 'UNITARIO' ? (parsed.data.recheioReceitaId ?? null) : null,
        },
      }),
      ...(parsed.data.tipo === 'KIT' && parsed.data.kitItens
        ? [
            prisma.produtoKitItem.createMany({
              data: parsed.data.kitItens.map((i) => ({
                kitId: id,
                componenteId: i.componenteId,
                qtde: i.qtde,
              })),
            }),
          ]
        : []),
      ...(campanhas.length > 0
        ? [prisma.campanhaProduto.createMany({ data: campanhas.map((campanhaId) => ({ campanhaId, produtoId: id })) })]
        : []),
    ])
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (!atual.precoVenda.equals(parsed.data.precoVenda.toDecimalPlaces(4))) {
    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      action: 'preco_alterado',
      entityType: 'produto',
      entityId: id,
      metadata: { antes: atual.precoVenda.toFixed(4), depois: parsed.data.precoVenda.toFixed(4) },
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
