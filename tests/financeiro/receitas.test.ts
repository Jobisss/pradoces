import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin, signInAsCustomer } from '../conftest'
import { criarIngrediente } from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.20', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-receitas', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { criarReceita, editarReceita } from '@/lib/actions/receitas'
import { custoCorrenteReceita } from '@/lib/custo/corrente'

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

describe('receitas Server Actions', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('cria receita com N itens numa transação', async () => {
    await asAdmin()
    const a = await criarIngrediente({ nome: 'Farinha receita' })
    const b = await criarIngrediente({ nome: 'Açúcar receita' })

    const result = await criarReceita({
      nome: 'Bolo simples',
      rendimentoPadrao: 10,
      custoGas: '1,50',
      validadeDias: 5,
      itens: [
        { ingredienteId: a.id, qtde: '200' },
        { ingredienteId: b.id, qtde: '100' },
      ],
    })

    expect(result.ok).toBe(true)
    const itens = await prisma.receitaIngrediente.findMany({ where: { receitaId: result.id } })
    expect(itens).toHaveLength(2)
  })

  it('rejeita ingrediente duplicado na mesma receita', async () => {
    await asAdmin()
    const a = await criarIngrediente({ nome: 'Duplicado' })

    const result = await criarReceita({
      nome: 'Receita inválida',
      rendimentoPadrao: 10,
      itens: [
        { ingredienteId: a.id, qtde: '100' },
        { ingredienteId: a.id, qtde: '50' },
      ],
    })

    expect(result.error).toBeTruthy()
    expect(result.fieldErrors?.itens).toBeTruthy()
  })

  it('editar substitui os itens (replace-all)', async () => {
    await asAdmin()
    const a = await criarIngrediente({ nome: 'Original' })
    const b = await criarIngrediente({ nome: 'Novo' })

    const criada = await criarReceita({
      nome: 'Receita editável',
      rendimentoPadrao: 10,
      itens: [{ ingredienteId: a.id, qtde: '100' }],
    })

    const editada = await editarReceita(criada.id!, {
      nome: 'Receita editável',
      rendimentoPadrao: 12,
      itens: [{ ingredienteId: b.id, qtde: '50' }],
    })
    expect(editada.ok).toBe(true)

    const itens = await prisma.receitaIngrediente.findMany({ where: { receitaId: criada.id } })
    expect(itens).toHaveLength(1)
    expect(itens[0].ingredienteId).toBe(b.id)
  })

  it('custoCorrenteReceita bate com o esperado após criar', async () => {
    await asAdmin()
    const leite = await criarIngrediente({ nome: 'Leite receita custo', unidadeBase: 'g' })
    await prisma.ingredienteCompra.create({
      data: {
        ingredienteId: leite.id,
        dataCompra: new Date('2026-06-01'),
        mercado: 'A',
        marca: 'X',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '395',
        precoPorEmbalagem: '3.95',
        qtdeTotalBase: '395',
        precoTotal: '3.95',
        custoPorUnidadeBase: '0.01',
      },
    })

    const criada = await criarReceita({
      nome: 'Receita custo',
      rendimentoPadrao: 20,
      custoGas: '2,00',
      itens: [{ ingredienteId: leite.id, qtde: '395' }],
    })

    const { total, porUnidade } = await custoCorrenteReceita(criada.id!)
    expect(total.toFixed(4)).toBe('5.9500')
    expect(porUnidade.toFixed(6)).toBe('0.297500')
  })

  it('EoP: sessão de customer não consegue criar receita', async () => {
    const customer = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(customer.id)
    ctx.cookie = cookie

    const a = await criarIngrediente({ nome: 'EoP receita' })
    const before = await prisma.receita.count()

    const result = await criarReceita({
      nome: 'Não deveria criar',
      rendimentoPadrao: 10,
      itens: [{ ingredienteId: a.id, qtde: '100' }],
    })

    expect(result.error).toBeTruthy()
    expect(await prisma.receita.count()).toBe(before)
  })
})
