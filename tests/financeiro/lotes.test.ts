import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto } from './fixtures'
import { hojeSaoPaulo, listarLotes } from '@/lib/lotes/queries'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.50', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-lotes-queries', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { produzirLote } from '@/lib/actions/lotes'

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

function addDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

async function produzirLoteDeTeste(opts: { validade: string; rendimentoReal?: number }) {
  const ingrediente = await criarIngrediente({ nome: `Lote query ${Date.now()}-${Math.random()}` })
  const compra = await registrarCompra({ ingredienteId: ingrediente.id, tamanhoEmbalagem: 100, precoPorEmbalagem: 10 })
  const receita = await criarReceita({
    rendimentoPadrao: 10,
    itens: [{ ingredienteId: ingrediente.id, qtde: 100 }],
  })
  const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receita.id, precoVenda: 5 })

  const result = await produzirLote({
    produtoId: produto.id,
    receitaId: receita.id,
    multiplicador: '1',
    rendimentoReal: opts.rendimentoReal ?? 10,
    validade: opts.validade,
    linhas: [{ ingredienteCompraId: compra.id, qtde: '100' }],
  })
  if (!result.ok) throw new Error(`fixture produzirLote falhou: ${result.error}`)
  return result.id!
}

describe('hojeSaoPaulo', () => {
  it('retorna a data civil no formato yyyy-mm-dd', () => {
    expect(hojeSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('listarLotes (LOTE-07)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('vigentes inclui hoje e o futuro, exclui vencidos', async () => {
    await asAdmin()
    const hoje = hojeSaoPaulo()
    const idHoje = await produzirLoteDeTeste({ validade: hoje })
    const idFuturo = await produzirLoteDeTeste({ validade: addDias(hoje, 5) })
    const idOntem = await produzirLoteDeTeste({ validade: addDias(hoje, -1) })

    const vigentes = await listarLotes('vigentes')
    const ids = vigentes.map((l) => l.id)
    expect(ids).toContain(idHoje)
    expect(ids).toContain(idFuturo)
    expect(ids).not.toContain(idOntem)
  })

  it('vencidos inclui só validade < hoje', async () => {
    await asAdmin()
    const hoje = hojeSaoPaulo()
    const idOntem = await produzirLoteDeTeste({ validade: addDias(hoje, -1) })
    const idHoje = await produzirLoteDeTeste({ validade: hoje })

    const vencidos = await listarLotes('vencidos')
    const ids = vencidos.map((l) => l.id)
    expect(ids).toContain(idOntem)
    expect(ids).not.toContain(idHoje)
  })

  it('esgotados: qtdeDisponivel 0 e ainda não vencido', async () => {
    await asAdmin()
    const hoje = hojeSaoPaulo()
    const idEsgotado = await produzirLoteDeTeste({ validade: addDias(hoje, 5) })
    await prisma.lote.update({ where: { id: idEsgotado }, data: { qtdeDisponivel: 0 } })
    const idNormal = await produzirLoteDeTeste({ validade: addDias(hoje, 5) })

    const esgotados = await listarLotes('esgotados')
    const ids = esgotados.map((l) => l.id)
    expect(ids).toContain(idEsgotado)
    expect(ids).not.toContain(idNormal)
  })

  it('LOTE-04: UPDATE que negativa qtde_disponivel aborta (CHECK)', async () => {
    await asAdmin()
    const hoje = hojeSaoPaulo()
    const id = await produzirLoteDeTeste({ validade: hoje })

    await expect(
      prisma.$executeRaw`UPDATE lotes SET qtde_disponivel = -1 WHERE id = ${id}::uuid`,
    ).rejects.toThrow()
  })
})

describe('produzirLote — multiplicador (D-07)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('multiplicador 1,5 escala 395 -> 592.500', async () => {
    await asAdmin()
    const ingrediente = await criarIngrediente({ nome: `Multiplicador ${Date.now()}` })
    const compra = await registrarCompra({
      ingredienteId: ingrediente.id,
      tamanhoEmbalagem: 395,
      precoPorEmbalagem: 3.95,
      marca: 'Marca Mult',
    })
    const receita = await criarReceita({
      rendimentoPadrao: 20,
      itens: [{ ingredienteId: ingrediente.id, qtde: 395 }],
    })
    const produto = await criarProduto({ tipo: 'UNITARIO', receitaId: receita.id, precoVenda: 20 })

    const result = await produzirLote({
      produtoId: produto.id,
      receitaId: receita.id,
      multiplicador: '1,5',
      rendimentoReal: 30,
      validade: '2026-12-31',
      linhas: [{ ingredienteCompraId: compra.id, qtde: '592,5' }],
    })

    expect(result.ok).toBe(true)
    const usos = await prisma.loteUsoIngrediente.findMany({ where: { loteId: result.id } })
    expect(usos[0].qtdeUsada.toFixed(3)).toBe('592.500')
    expect(usos[0].marcaSnapshot).toBe('Marca Mult')
    expect(usos[0].custoUnitarioCongelado.toFixed(6)).toBe('0.010000')
  })
})
