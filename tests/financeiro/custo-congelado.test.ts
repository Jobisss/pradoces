import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin, signInAsCustomer } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto } from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.40', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-lotes', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { produzirLotes } from '@/lib/actions/lotes'

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

/** Monta ingrediente + receita (1 item, qtde `qtdeItem`) + produto (com 1 variação "Padrão"), retorna tudo. */
async function montarCenario(qtdeItem: string, rendimentoPadrao = 20) {
  const ingrediente = await criarIngrediente({ nome: `Leite condensado ${Date.now()}-${Math.random()}` })
  const compra = await registrarCompra({
    ingredienteId: ingrediente.id,
    tamanhoEmbalagem: 395,
    precoPorEmbalagem: 3.95,
    marca: 'Moça',
  })
  const receita = await criarReceita({
    rendimentoPadrao,
    itens: [{ ingredienteId: ingrediente.id, qtde: qtdeItem }],
  })
  const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receita.id, precoVenda: 20 })
  return { ingrediente, compra, receita, produto }
}

/** D-13: produzirLotes espera variacoes[] — pra uma variação só, sem recheio, é isso aqui. */
function payloadUmaVariacao(opts: {
  produtoId: string
  variacaoId: string
  receitaId: string
  multiplicador: string
  rendimentoReal: number
  validade: string
  linhasBase: Array<{ ingredienteCompraId: string; qtde: string }>
}) {
  return {
    produtoId: opts.produtoId,
    receitaId: opts.receitaId,
    multiplicador: opts.multiplicador,
    validade: opts.validade,
    linhasBase: opts.linhasBase,
    variacoes: [{ variacaoId: opts.variacaoId, rendimentoReal: opts.rendimentoReal, linhasRecheio: [] }],
  }
}

describe('produzirLotes — custo congelado', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('LOTE-08: custo congelado sobrevive a mudança de preço corrente', async () => {
    await asAdmin()
    const { ingrediente, compra, receita, produto } = await montarCenario('395')

    const result = await produzirLotes(
      payloadUmaVariacao({
        produtoId: produto.id,
        variacaoId: produto.variacao!.id,
        receitaId: receita.id,
        multiplicador: '1',
        rendimentoReal: 20,
        validade: '2026-12-31',
        linhasBase: [{ ingredienteCompraId: compra.id, qtde: '395' }],
      }),
    )
    expect(result.ok).toBe(true)
    const loteId = result.lotes![0].id

    // Preço corrente muda: nova compra mais cara (Italac) vira a "última".
    await registrarCompra({
      ingredienteId: ingrediente.id,
      tamanhoEmbalagem: 395,
      precoPorEmbalagem: 7.9,
      marca: 'Italac',
    })

    const usos = await prisma.loteUsoIngrediente.findMany({ where: { loteId } })
    expect(usos).toHaveLength(1)
    expect(usos[0].custoUnitarioCongelado.toFixed(6)).toBe('0.010000')
    expect(usos[0].marcaSnapshot).toBe('Moça')

    await expect(
      prisma.ingredienteCompra.update({ where: { id: compra.id }, data: { marca: 'Y' } }),
    ).rejects.toThrow(/imutavel/)

    const italac = await prisma.ingredienteCompra.findFirstOrThrow({ where: { marca: 'Italac' } })
    await expect(
      prisma.ingredienteCompra.update({ where: { id: italac.id }, data: { marca: 'Italac Novo' } }),
    ).resolves.toBeTruthy()
  })

  it('recomputa o custo server-side — o payload nem tem campo de custo', async () => {
    await asAdmin()
    const { compra, receita, produto } = await montarCenario('395')

    const payload = payloadUmaVariacao({
      produtoId: produto.id,
      variacaoId: produto.variacao!.id,
      receitaId: receita.id,
      multiplicador: '1',
      rendimentoReal: 20,
      validade: '2026-12-31',
      linhasBase: [{ ingredienteCompraId: compra.id, qtde: '395' }],
    })
    expect('custo' in payload).toBe(false)

    const result = await produzirLotes(payload)
    expect(result.ok).toBe(true)
    // 395 x 0.01 = 3.95 total, sem gás, / 20 = 0.1975
    expect(result.lotes![0].custoTotal).toBe('3.9500')
    expect(result.lotes![0].custoPorUnidade).toBe('0.197500')
  })

  it('D-06: custoPorUnidadeCongelado usa o rendimento REAL, não o padrão', async () => {
    await asAdmin()
    const { compra, receita, produto } = await montarCenario('395', 20)

    const result = await produzirLotes(
      payloadUmaVariacao({
        produtoId: produto.id,
        variacaoId: produto.variacao!.id,
        receitaId: receita.id,
        multiplicador: '1',
        rendimentoReal: 18,
        validade: '2026-12-31',
        linhasBase: [{ ingredienteCompraId: compra.id, qtde: '395' }],
      }),
    )

    expect(result.ok).toBe(true)
    // total 3.95 / 18 (não / 20)
    expect(result.lotes![0].custoPorUnidade).toBe('0.219444')
  })

  it('D-07: multiplicador escala qtdeUsada', async () => {
    await asAdmin()
    const { compra, receita, produto } = await montarCenario('395')

    const result = await produzirLotes(
      payloadUmaVariacao({
        produtoId: produto.id,
        variacaoId: produto.variacao!.id,
        receitaId: receita.id,
        multiplicador: '1,5',
        rendimentoReal: 20,
        validade: '2026-12-31',
        linhasBase: [{ ingredienteCompraId: compra.id, qtde: '592,5' }],
      }),
    )

    expect(result.ok).toBe(true)
    const usos = await prisma.loteUsoIngrediente.findMany({ where: { loteId: result.lotes![0].id } })
    expect(usos[0].qtdeUsada.toFixed(3)).toBe('592.500')
  })

  it('D-05: grava a compra escolhida pelo usuário, mesmo não sendo a mais recente', async () => {
    await asAdmin()
    const ingrediente = await criarIngrediente({ nome: `Manteiga D05 ${Date.now()}` })
    const compraAntiga = await registrarCompra({
      ingredienteId: ingrediente.id,
      tamanhoEmbalagem: 200,
      precoPorEmbalagem: 4,
      marca: 'Antiga',
      dataCompra: new Date('2026-01-01'),
    })
    await registrarCompra({
      ingredienteId: ingrediente.id,
      tamanhoEmbalagem: 200,
      precoPorEmbalagem: 10,
      marca: 'Recente',
      dataCompra: new Date('2026-06-01'),
    })
    const receita = await criarReceita({
      rendimentoPadrao: 10,
      itens: [{ ingredienteId: ingrediente.id, qtde: 200 }],
    })
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receita.id, precoVenda: 20 })

    const result = await produzirLotes(
      payloadUmaVariacao({
        produtoId: produto.id,
        variacaoId: produto.variacao!.id,
        receitaId: receita.id,
        multiplicador: '1',
        rendimentoReal: 10,
        validade: '2026-12-31',
        linhasBase: [{ ingredienteCompraId: compraAntiga.id, qtde: '200' }],
      }),
    )

    expect(result.ok).toBe(true)
    const usos = await prisma.loteUsoIngrediente.findMany({ where: { loteId: result.lotes![0].id } })
    expect(usos[0].ingredienteCompraId).toBe(compraAntiga.id)
    expect(usos[0].marcaSnapshot).toBe('Antiga')
  })

  it('EoP (T-02-06): sessão de customer não consegue produzir lote', async () => {
    const customer = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(customer.id)
    ctx.cookie = cookie

    const before = await prisma.lote.count()
    const result = await produzirLotes({
      produtoId: 'nao-existe',
      receitaId: 'nao-existe',
      multiplicador: '1',
      validade: '2026-12-31',
      linhasBase: [],
      variacoes: [],
    })

    expect(result.error).toBeTruthy()
    expect(await prisma.lote.count()).toBe(before)
  })
})
