import { describe, it, expect, beforeEach, vi } from 'vitest'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsAdmin, signInAsCustomer } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto, produzirLote } from './fixtures'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.77', cookie: '' }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-resgate', cookie: ctx.cookie }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { resgatarItem } from '@/lib/actions/resgate'
import { confirmarReserva, rejeitarReserva } from '@/lib/actions/reservas-admin'
import { relatorioFaturamento } from '@/lib/admin/relatorios'

/**
 * Resgate consome estoque de verdade e o custo dele entra no financeiro.
 *
 * Antes: `resgatarItem` só CONFERIA que existia lote (findFirst de
 * existência). O doce saía da casa, `qtdeDisponivel` não mexia, duas pessoas
 * podiam resgatar a mesma última unidade, e como todo relatório filtrava
 * `tipo: 'PADRAO'` o custo do doce trocado por pontos não aparecia em lugar
 * nenhum — o lucro vinha inflado.
 */
describe('resgate consome estoque e reconhece custo (RESG-03/04, FIN-01)', () => {
  beforeEach(truncateAll)

  /** Ingrediente → receita → produto → lote, com custo/un conhecido. */
  async function montarCenario(rendimentoReal = 10) {
    const ingrediente = await criarIngrediente()
    await registrarCompra({
      ingredienteId: ingrediente.id,
      tamanhoEmbalagem: 100,
      precoPorEmbalagem: 20,
      marca: 'Marca X',
    })
    // 100g de ingrediente a R$ 0,20/g = R$ 20 por lote; 10 unidades = R$ 2,00/un.
    const receita = await criarReceita({
      rendimentoPadrao: rendimentoReal,
      itens: [{ ingredienteId: ingrediente.id, qtde: 100 }],
    })
    const produto = await criarProduto({ receitaId: receita.id, precoVenda: 10 })
    const lote = await produzirLote({
      receitaId: receita.id,
      produtoId: produto.id,
      variacaoId: produto.variacao!.id,
      rendimentoReal,
    })
    const item = await prisma.itemResgatavel.create({
      data: { produtoId: produto.id, variacaoId: produto.variacao!.id, custoPontos: 50 },
    })
    return { produto, lote, item }
  }

  async function clienteComPontos(pontos: number) {
    const cliente = await createTestUser()
    await prisma.pontosTransacao.create({
      data: { clienteId: cliente.id, valor: pontos, motivo: 'AJUSTE_ADMIN' },
    })
    const { cookie } = await signInAsCustomer(cliente.id)
    ctx.cookie = cookie
    return cliente
  }

  async function comoAdmin() {
    const admin = await createTestUser({ role: 'admin' })
    const { cookie } = await signInAsAdmin(admin.id)
    ctx.cookie = cookie
    return admin
  }

  it('cria ReservaItem com preço zero e segura o lote (soft-hold)', async () => {
    const { lote, item } = await montarCenario()
    await clienteComPontos(100)

    const res = await resgatarItem(item.id, 'amanhã de manhã')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)

    const reserva = await prisma.reserva.findFirstOrThrow({
      where: { tipo: 'RESGATE' },
      include: { itens: true },
    })
    expect(reserva.itens).toHaveLength(1)
    expect(reserva.itens[0].loteId).toBe(lote.id)
    expect(reserva.itens[0].qtde).toBe(1)
    // Preço 0: quem pagou foram os pontos. Sem isso o resgate viraria receita.
    expect(new Decimal(reserva.itens[0].precoUnitarioCongelado.toString()).toNumber()).toBe(0)

    const depois = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })
    expect(depois.qtdeReservada).toBe(1)
    // Baixa de verdade só na confirmação, igual reserva normal.
    expect(depois.qtdeDisponivel).toBe(10)
  })

  it('confirmar o resgate baixa qtdeDisponivel e não credita pontos', async () => {
    const { lote, item } = await montarCenario()
    const cliente = await clienteComPontos(100)
    await resgatarItem(item.id, 'amanhã de manhã')
    const reserva = await prisma.reserva.findFirstOrThrow({ where: { tipo: 'RESGATE' } })

    await comoAdmin()
    const res = await confirmarReserva(reserva.id)
    expect(res.error).toBeUndefined()

    const depois = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })
    expect(depois.qtdeDisponivel).toBe(9)
    expect(depois.qtdeReservada).toBe(0)

    // 100 de crédito inicial − 50 do resgate. Trocar pontos por doce não gera pontos.
    const saldo = await prisma.pontosTransacao.aggregate({
      where: { clienteId: cliente.id },
      _sum: { valor: true },
    })
    expect(saldo._sum.valor).toBe(50)
  })

  it('recusar o resgate devolve o soft-hold e os pontos', async () => {
    const { lote, item } = await montarCenario()
    const cliente = await clienteComPontos(100)
    await resgatarItem(item.id, 'amanhã de manhã')
    const reserva = await prisma.reserva.findFirstOrThrow({ where: { tipo: 'RESGATE' } })

    await comoAdmin()
    await rejeitarReserva(reserva.id)

    const depois = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })
    expect(depois.qtdeReservada).toBe(0)
    expect(depois.qtdeDisponivel).toBe(10)

    const saldo = await prisma.pontosTransacao.aggregate({
      where: { clienteId: cliente.id },
      _sum: { valor: true },
    })
    expect(saldo._sum.valor).toBe(100)
  })

  it('o custo do resgate entra no relatório e derruba o lucro', async () => {
    const { item } = await montarCenario()
    await clienteComPontos(100)
    await resgatarItem(item.id, 'amanhã de manhã')
    const reserva = await prisma.reserva.findFirstOrThrow({ where: { tipo: 'RESGATE' } })

    await comoAdmin()
    await confirmarReserva(reserva.id)

    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const relatorio = await relatorioFaturamento(ontem, amanha)

    // Nenhuma venda em R$ — só o resgate.
    expect(relatorio.faturamentoTotal.toNumber()).toBe(0)
    expect(relatorio.custoVendas.toNumber()).toBe(0)

    // R$ 20 de lote / 10 unidades = R$ 2,00 a unidade resgatada.
    expect(relatorio.resgates.unidades).toBe(1)
    expect(relatorio.resgates.custo.toNumber()).toBeCloseTo(2, 4)
    expect(relatorio.custoTotal.toNumber()).toBeCloseTo(2, 4)
    // O buraco antigo: isso dava 0 porque o custo do resgate sumia.
    expect(relatorio.lucroTotal.toNumber()).toBeCloseTo(-2, 4)
    // Preço de venda congelado do que ela deixou de faturar.
    expect(relatorio.valorDeixadoDeGanhar.toNumber()).toBeCloseTo(10, 4)
  })

  it('não deixa resgatar quando o estoque livre acabou', async () => {
    const { lote, item } = await montarCenario(1)
    await clienteComPontos(200)

    const primeiro = await resgatarItem(item.id, 'amanhã')
    expect(primeiro.ok).toBe(true)

    // Única unidade já está em soft-hold — o segundo resgate não pode passar.
    const segundo = await resgatarItem(item.id, 'depois de amanhã')
    expect(segundo.error).toBeDefined()

    const depois = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })
    expect(depois.qtdeReservada).toBe(1)
  })
})
