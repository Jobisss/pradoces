import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin, signInAsCustomer } from '../conftest'
import {
  criarIngrediente,
  registrarCompra as fixtureRegistrarCompra,
  criarReceita,
  produzirLote,
} from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.10', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-compras', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
// revalidatePath needs a request-scoped static-generation store that only
// exists inside a real Next.js request — outside the runtime (unit tests
// calling the action directly) it throws. Stub it, same as any other
// Next-runtime-only API under vitest.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { registrarCompra, corrigirCompra, excluirCompra, sugestoesMarca } from '@/lib/actions/compras'
import { ultimasCompras } from '@/lib/custo/corrente'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

describe('compras Server Actions', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('ING-03: deriva qtdeTotalBase/precoTotal/custoPorUnidadeBase server-side', async () => {
    await asAdmin()
    const ing = await criarIngrediente({ nome: 'Farinha' })

    const result = await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'Mercado Central',
        marca: 'Dona Benta',
        qtdeEmbalagens: '2',
        tamanhoEmbalagem: '395',
        precoPorEmbalagem: '5,80',
      }),
    )

    expect(result.ok).toBe(true)
    const row = await prisma.ingredienteCompra.findUniqueOrThrow({ where: { id: result.item!.id } })
    expect(row.qtdeTotalBase.toFixed(3)).toBe('790.000')
    expect(row.precoTotal.toFixed(4)).toBe('11.6000')
    expect(row.custoPorUnidadeBase.toFixed(6)).toBe('0.014684')
  })

  it('ING-06: ingrediente tipo EMBALAGEM aceita compra pelo mesmo fluxo', async () => {
    await asAdmin()
    const emb = await criarIngrediente({ nome: 'Forminha', unidadeBase: 'un', tipo: 'EMBALAGEM' })

    const result = await registrarCompra(
      undefined,
      form({
        ingredienteId: emb.id,
        dataCompra: '2026-06-01',
        mercado: 'Papelaria',
        marca: 'Genérica',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '20',
      }),
    )

    expect(result.ok).toBe(true)
  })

  it('D-04: canonicaliza marca reaproveitando a grafia já usada', async () => {
    await asAdmin()
    const ing = await criarIngrediente({ nome: 'Leite condensado D04' })

    await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'Moça',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '395',
        precoPorEmbalagem: '4',
      }),
    )
    const segunda = await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-02',
        mercado: 'A',
        marca: 'moça',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '395',
        precoPorEmbalagem: '4',
      }),
    )

    const row = await prisma.ingredienteCompra.findUniqueOrThrow({ where: { id: segunda.item!.id } })
    expect(row.marca).toBe('Moça')

    const sugestoes = await sugestoesMarca('mo')
    expect(sugestoes.filter((m) => m === 'Moça')).toHaveLength(1)
  })

  it('D-03: corrigirCompra e excluirCompra funcionam em compra sem lote', async () => {
    await asAdmin()
    const ing = await criarIngrediente({ nome: 'Chocolate D03' })
    const registrada = await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'Marca A',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '10',
      }),
    )

    const corrigida = await corrigirCompra(
      registrada.item!.id,
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'Marca B',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '12',
      }),
    )
    expect(corrigida.ok).toBe(true)

    const excluida = await excluirCompra(registrada.item!.id)
    expect(excluida.ok).toBe(true)
    expect(await prisma.ingredienteCompra.findUnique({ where: { id: registrada.item!.id } })).toBeNull()
  })

  it('ING-04/ING-07: compra usada em lote fica imutável (copy amigável + trigger)', async () => {
    await asAdmin()
    const ing = await criarIngrediente({ nome: 'Ovos ING07' })
    const compra = await fixtureRegistrarCompra({
      ingredienteId: ing.id,
      tamanhoEmbalagem: 12,
      precoPorEmbalagem: 6,
    })
    const receita = await criarReceita({
      rendimentoPadrao: 12,
      itens: [{ ingredienteId: ing.id, qtde: 12 }],
    })
    const produto = await prisma.produto.create({
      data: {
        nome: 'Bolo ING07',
        descricao: 'd',
        categoria: 'c',
        tipo: 'UNITARIO',
        precoVenda: '10',
        receitaId: receita.id,
      },
    })
    await produzirLote({ receitaId: receita.id, produtoId: produto.id, rendimentoReal: 12 })

    const corrigida = await corrigirCompra(
      compra.id,
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'X',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '12',
        precoPorEmbalagem: '6',
      }),
    )
    expect(corrigida.error).toMatch(/já foi usada num lote/)

    const excluida = await excluirCompra(compra.id)
    expect(excluida.error).toMatch(/já foi usada num lote/)

    await expect(
      prisma.ingredienteCompra.update({ where: { id: compra.id }, data: { marca: 'Y' } }),
    ).rejects.toThrow(/imutavel/)
  })

  it('ING-05: ultimasCompras retorna a mais recente', async () => {
    await asAdmin()
    const ing = await criarIngrediente({ nome: 'Açúcar ING05' })
    await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-01-01',
        mercado: 'A',
        marca: 'Antiga',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '5',
      }),
    )
    await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'Recente',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '9',
      }),
    )

    const map = await ultimasCompras([ing.id])
    expect(map.get(ing.id)?.marca).toBe('Recente')
  })

  it('EoP (T-02-06): sessão de customer não consegue registrar compra', async () => {
    const customer = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(customer.id)
    ctx.cookie = cookie

    const ing = await criarIngrediente({ nome: 'EoP ingrediente' })
    const before = await prisma.ingredienteCompra.count()

    const result = await registrarCompra(
      undefined,
      form({
        ingredienteId: ing.id,
        dataCompra: '2026-06-01',
        mercado: 'A',
        marca: 'X',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '100',
        precoPorEmbalagem: '10',
      }),
    )

    expect(result.error).toBeTruthy()
    expect(await prisma.ingredienteCompra.count()).toBe(before)
  })
})
