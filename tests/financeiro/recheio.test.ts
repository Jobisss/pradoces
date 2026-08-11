import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto } from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.60', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-recheio', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { custoCorrenteProduto, margensCorrentesBatch } from '@/lib/custo/corrente'
import { criarProduto as criarProdutoAction } from '@/lib/actions/produtos'
import { produzirLote } from '@/lib/actions/lotes'

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

/** Gramas de recheio usadas em cada unidade do produto, nos cenários abaixo. */
const GRAMAS_USADAS = '3'

/**
 * Base "massa" (custo/un conhecido) + recheio "nutella" tratado como um LOTE
 * (D-12 revisado): a receita de recheio é o pote inteiro (300g), não a dose
 * de 1 unidade — o rateio por grama é feito via Produto.recheioGramasUsadas
 * (regra de 3: custo total ÷ peso total × gramas usadas), não mais pelo
 * rendimentoPadrao da receita de recheio.
 */
async function montarCenarioComRecheio() {
  const ingredienteBase = await criarIngrediente({ nome: `Farinha recheio ${Date.now()}` })
  await registrarCompra({ ingredienteId: ingredienteBase.id, tamanhoEmbalagem: 100, precoPorEmbalagem: 10 }) // 0.10/g
  const receitaBase = await criarReceita({
    rendimentoPadrao: 10,
    itens: [{ ingredienteId: ingredienteBase.id, qtde: 100 }],
  }) // custo/un = (100*0.10)/10 = 1.00

  const nutella = await criarIngrediente({ nome: `Nutella ${Date.now()}` })
  await registrarCompra({ ingredienteId: nutella.id, tamanhoEmbalagem: 350, precoPorEmbalagem: 35 }) // 0.10/g
  const receitaRecheio = await criarReceita({
    rendimentoPadrao: 1,
    itens: [{ ingredienteId: nutella.id, qtde: 300 }],
  }) // custo total = 300*0.10 = 30.00; custo/g = 30/300 = 0.10/g; ×3g usadas = 0.30/un

  return { ingredienteBase, receitaBase, nutella, receitaRecheio }
}

describe('custo do produto com recheio (D-12)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('custoCorrenteProduto soma base + recheio', async () => {
    await asAdmin()
    const { receitaBase, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({
      tipo: 'UNITARIO',
      receitaId: receitaBase.id,
      precoVenda: 5,
    })
    await prisma.produto.update({
      where: { id: produto.id },
      data: { recheioReceitaId: receitaRecheio.id, recheioGramasUsadas: GRAMAS_USADAS },
    })

    const { custo } = await custoCorrenteProduto(produto.id)
    expect(custo.toFixed(2)).toBe('1.30') // 1.00 (base) + 0.30 (recheio)
  })

  it('margensCorrentesBatch também soma base + recheio', async () => {
    await asAdmin()
    const { receitaBase, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 5 })
    await prisma.produto.update({
      where: { id: produto.id },
      data: { recheioReceitaId: receitaRecheio.id, recheioGramasUsadas: GRAMAS_USADAS },
    })

    const margens = await margensCorrentesBatch()
    const item = margens.find((m) => m.produtoId === produto.id)!
    expect(item.custo!.toFixed(2)).toBe('1.30')
  })

  it('custo do recheio é proporcional às gramas usadas (regra de 3)', async () => {
    await asAdmin()
    const { receitaBase, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 20 })
    // 30g (10× as 3g do outro teste) — custo do recheio tem que escalar junto,
    // não ficar preso ao rendimentoPadrao=1 da receita (bug original).
    await prisma.produto.update({
      where: { id: produto.id },
      data: { recheioReceitaId: receitaRecheio.id, recheioGramasUsadas: '30' },
    })

    const { custo } = await custoCorrenteProduto(produto.id)
    // 1.00 (base) + 30g × 0.10/g (300g a 30.00 total) = 1.00 + 3.00 = 4.00
    expect(custo.toFixed(2)).toBe('4.00')
  })

  it('sem recheioGramasUsadas configurado, custo do recheio não entra (fica só a base)', async () => {
    await asAdmin()
    const { receitaBase, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 5 })
    // recheioReceitaId setado, mas SEM recheioGramasUsadas (config incompleta).
    await prisma.produto.update({ where: { id: produto.id }, data: { recheioReceitaId: receitaRecheio.id } })

    const { custo } = await custoCorrenteProduto(produto.id)
    expect(custo.toFixed(2)).toBe('1.00')
  })

  it('PROD-09 bloqueia preço abaixo do custo TOTAL (base+recheio)', async () => {
    await asAdmin()
    const { receitaBase, receitaRecheio } = await montarCenarioComRecheio()

    // preço 1,20 cobre a base (1.00) mas não base+recheio (1.30)
    const bloqueado = await criarProdutoAction({
      nome: 'Brownie recheado barato',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      precoVenda: '1,20',
      receitaId: receitaBase.id,
      recheioReceitaId: receitaRecheio.id,
      recheioGramasUsadas: GRAMAS_USADAS,
    })
    expect(bloqueado.error).toMatch(/abaixo do custo/)

    const permitido = await criarProdutoAction({
      nome: 'Brownie recheado com margem',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      precoVenda: '3,00',
      receitaId: receitaBase.id,
      recheioReceitaId: receitaRecheio.id,
      recheioGramasUsadas: GRAMAS_USADAS,
    })
    expect(permitido.ok).toBe(true)
  })
})

describe('produzirLote com recheio — escalas diferentes (D-12)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('base escala pelo multiplicador, recheio escala pelo rendimento real', async () => {
    await asAdmin()
    const { ingredienteBase, receitaBase, nutella, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 5 })
    await prisma.produto.update({
      where: { id: produto.id },
      data: { recheioReceitaId: receitaRecheio.id, recheioGramasUsadas: GRAMAS_USADAS },
    })

    const compraBase = await prisma.ingredienteCompra.findFirstOrThrow({
      where: { ingredienteId: ingredienteBase.id },
    })
    const compraRecheio = await prisma.ingredienteCompra.findFirstOrThrow({
      where: { ingredienteId: nutella.id },
    })

    // multiplicador 2x (base: 100g -> 200g); rendimento real 25 unidades (recheio: 3g * 25 = 75g)
    const result = await produzirLote({
      produtoId: produto.id,
      receitaId: receitaBase.id,
      multiplicador: '2',
      rendimentoReal: 25,
      validade: '2026-12-31',
      linhas: [
        { ingredienteCompraId: compraBase.id, qtde: '200' },
        { ingredienteCompraId: compraRecheio.id, qtde: '75' },
      ],
    })

    expect(result.ok).toBe(true)
    const usos = await prisma.loteUsoIngrediente.findMany({ where: { loteId: result.id } })
    expect(usos).toHaveLength(2)

    const usoBase = usos.find((u) => u.ingredienteCompraId === compraBase.id)!
    const usoRecheio = usos.find((u) => u.ingredienteCompraId === compraRecheio.id)!
    expect(usoBase.qtdeUsada.toFixed(3)).toBe('200.000')
    expect(usoRecheio.qtdeUsada.toFixed(3)).toBe('75.000')

    // custo total: base 200g*0.10=20.00 + recheio 75g*0.10=7.50 = 27.50; /25 un = 1.10/un
    expect(result.custoTotal).toBe('27.5000')
    expect(result.custoPorUnidade).toBe('1.100000')
  })

  it('rejeita quando a qtde do recheio não bate com rendimentoReal × qtde base (dados desatualizados)', async () => {
    await asAdmin()
    const { ingredienteBase, receitaBase, nutella, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 5 })
    await prisma.produto.update({
      where: { id: produto.id },
      data: { recheioReceitaId: receitaRecheio.id, recheioGramasUsadas: GRAMAS_USADAS },
    })

    const compraBase = await prisma.ingredienteCompra.findFirstOrThrow({
      where: { ingredienteId: ingredienteBase.id },
    })
    const compraRecheio = await prisma.ingredienteCompra.findFirstOrThrow({
      where: { ingredienteId: nutella.id },
    })

    const result = await produzirLote({
      produtoId: produto.id,
      receitaId: receitaBase.id,
      multiplicador: '1',
      rendimentoReal: 25,
      validade: '2026-12-31',
      linhas: [
        { ingredienteCompraId: compraBase.id, qtde: '100' },
        // devia ser 25*3=75, mandando escalado pelo multiplicador (errado) pra provar a rejeição
        { ingredienteCompraId: compraRecheio.id, qtde: '3' },
      ],
    })

    expect(result.error).toMatch(/dados mudaram/)
  })

  it('rejeita produzir lote com recheio sem recheioGramasUsadas configurado', async () => {
    await asAdmin()
    const { ingredienteBase, receitaBase, receitaRecheio } = await montarCenarioComRecheio()
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaBase.id, precoVenda: 5 })
    // recheioReceitaId setado, mas SEM recheioGramasUsadas.
    await prisma.produto.update({ where: { id: produto.id }, data: { recheioReceitaId: receitaRecheio.id } })

    const compraBase = await prisma.ingredienteCompra.findFirstOrThrow({
      where: { ingredienteId: ingredienteBase.id },
    })

    const result = await produzirLote({
      produtoId: produto.id,
      receitaId: receitaBase.id,
      multiplicador: '1',
      rendimentoReal: 10,
      validade: '2026-12-31',
      linhas: [{ ingredienteCompraId: compraBase.id, qtde: '100' }],
    })

    expect(result.error).toMatch(/falta configurar/)
  })
})
