import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin, signInAsCustomer } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto } from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.30', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-produtos', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { criarProduto as criarProdutoAction, editarProduto } from '@/lib/actions/produtos'
import { salvarMargemGlobal } from '@/lib/actions/config'

async function asAdmin() {
  const admin = await createTestUser({ role: 'admin' })
  const { cookie } = await signInAsAdmin(admin.id)
  ctx.cookie = cookie
  return admin
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

async function receitaComCustoConhecido(custoPorUnidade: string, rendimento = 1) {
  const ing = await criarIngrediente({ nome: `Ing custo ${Date.now()}-${Math.random()}` })
  await registrarCompra({
    ingredienteId: ing.id,
    tamanhoEmbalagem: 1,
    precoPorEmbalagem: custoPorUnidade,
  })
  return criarReceita({ rendimentoPadrao: rendimento, itens: [{ ingredienteId: ing.id, qtde: 1 }] })
}

describe('produtos Server Actions', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
    ctx.cookie = ''
  })

  it('PROD-09 bloqueia preço abaixo do custo', async () => {
    await asAdmin()
    const receita = await receitaComCustoConhecido('0.50')

    const result = await criarProdutoAction({
      nome: 'Doce barato demais',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      receitaId: receita.id,
      variacoes: [{ nome: 'Padrão', precoVenda: '0,40' }],
    })

    expect(result.error).toMatch(/abaixo do custo/)
    expect(await prisma.produto.count()).toBe(0)
  })

  it('PROD-09 permite preço acima do custo', async () => {
    await asAdmin()
    const receita = await receitaComCustoConhecido('0.50')

    const result = await criarProdutoAction({
      nome: 'Doce com margem',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      receitaId: receita.id,
      variacoes: [{ nome: 'Padrão', precoVenda: '2,00' }],
    })

    expect(result.ok).toBe(true)
    const variacao = await prisma.variacao.findFirstOrThrow({ where: { produtoId: result.id } })
    expect(variacao.precoVenda.toFixed(4)).toBe('2.0000')
  })

  it('D-11 kit: bloqueia abaixo da soma dos componentes, permite acima', async () => {
    await asAdmin()
    const receitaA = await receitaComCustoConhecido('1.00')
    const produtoA = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaA.id, precoVenda: 5 })
    const receitaB = await receitaComCustoConhecido('2.00')
    const produtoB = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaB.id, precoVenda: 5 })
    // soma dos componentes: 1×1.00 + 1×2.00 = 3.00

    const bloqueado = await criarProdutoAction({
      nome: 'Kit barato',
      descricao: 'd',
      categoria: 'c',
      tipo: 'KIT',
      precoVenda: '2,50',
      kitItens: [
        { componenteId: produtoA.id, componenteVariacaoId: produtoA.variacao!.id, qtde: 1 },
        { componenteId: produtoB.id, componenteVariacaoId: produtoB.variacao!.id, qtde: 1 },
      ],
    })
    expect(bloqueado.error).toMatch(/abaixo do custo/)

    const permitido = await criarProdutoAction({
      nome: 'Kit com margem',
      descricao: 'd',
      categoria: 'c',
      tipo: 'KIT',
      precoVenda: '4,00',
      kitItens: [
        { componenteId: produtoA.id, componenteVariacaoId: produtoA.variacao!.id, qtde: 1 },
        { componenteId: produtoB.id, componenteVariacaoId: produtoB.variacao!.id, qtde: 1 },
      ],
    })
    expect(permitido.ok).toBe(true)
  })

  it('kit inválido: componente apontando pra outro KIT é rejeitado', async () => {
    await asAdmin()
    const receitaA = await receitaComCustoConhecido('1.00')
    const produtoA = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaA.id, precoVenda: 5 })
    const outroKit = await criarProduto({
      tipo: 'KIT',
      precoVenda: 10,
      kitItens: [{ componenteId: produtoA.id, componenteVariacaoId: produtoA.variacao!.id, qtde: 1 }],
    })

    const result = await criarProdutoAction({
      nome: 'Kit de kit',
      descricao: 'd',
      categoria: 'c',
      tipo: 'KIT',
      precoVenda: '100,00',
      // outroKit não é UNITARIO — variacaoId não importa pra provar a rejeição
      // (qualquer uuid válido serve, o server rejeita pelo tipo do componente).
      kitItens: [{ componenteId: outroKit.id, componenteVariacaoId: produtoA.variacao!.id, qtde: 1 }],
    })

    expect(result.error).toBeTruthy()
    expect(await prisma.produto.count({ where: { nome: 'Kit de kit' } })).toBe(0)
  })

  it('audit preco_alterado registra antes/depois quando o preço da variação muda', async () => {
    const admin = await asAdmin()
    const receita = await receitaComCustoConhecido('0.50')
    const criado = await criarProdutoAction({
      nome: 'Produto com audit',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      receitaId: receita.id,
      variacoes: [{ nome: 'Padrão', precoVenda: '2,00' }],
    })
    expect(criado.ok).toBe(true)

    const variacaoOriginal = await prisma.variacao.findFirstOrThrow({ where: { produtoId: criado.id! } })

    const editado = await editarProduto(criado.id!, {
      nome: 'Produto com audit',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      receitaId: receita.id,
      variacoes: [{ id: variacaoOriginal.id, nome: 'Padrão', precoVenda: '3,50' }],
    })
    expect(editado.ok).toBe(true)

    const evento = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'preco_alterado', entityId: variacaoOriginal.id },
    })
    expect(evento.actorId).toBe(admin.id)
    const metadata = evento.metadata as { antes: string; depois: string }
    expect(metadata.antes).toBe('2.0000')
    expect(metadata.depois).toBe('3.5000')
  })

  it('config: salvarMargemGlobal cria e depois atualiza o singleton', async () => {
    await asAdmin()

    await salvarMargemGlobal(undefined, form({ margemMinimaPadrao: '25' }))
    let config = await prisma.configuracao.findUniqueOrThrow({ where: { id: 1 } })
    expect(config.margemMinimaPadrao.toFixed(2)).toBe('25.00')

    await salvarMargemGlobal(undefined, form({ margemMinimaPadrao: '35' }))
    config = await prisma.configuracao.findUniqueOrThrow({ where: { id: 1 } })
    expect(config.margemMinimaPadrao.toFixed(2)).toBe('35.00')
    expect(await prisma.configuracao.count()).toBe(1)
  })

  it('EoP (T-02-06): sessão de customer não consegue criar produto nem mexer na config', async () => {
    const customer = await createTestUser({ role: 'customer' })
    const { cookie } = await signInAsCustomer(customer.id)
    ctx.cookie = cookie

    const produtoResult = await criarProdutoAction({
      nome: 'Não deveria criar',
      descricao: 'd',
      categoria: 'c',
      tipo: 'UNITARIO',
      receitaId: undefined,
    })
    expect(produtoResult.error).toBeTruthy()
    expect(await prisma.produto.count()).toBe(0)

    const configResult = await salvarMargemGlobal(undefined, form({ margemMinimaPadrao: '10' }))
    expect(configResult.error).toBeTruthy()
    expect(await prisma.configuracao.count()).toBe(0)
  })
})
