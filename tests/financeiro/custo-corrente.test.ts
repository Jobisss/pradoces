import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'decimal.js'
import {
  ultimasCompras,
  custoCorrenteReceita,
  custoCorrenteKit,
  margemPercent,
} from '@/lib/custo/corrente'
import { computeLoteSnapshot } from '@/lib/custo/congelado'
import { truncateAll } from '../conftest'
import { criarIngrediente, registrarCompra, criarReceita, criarProduto } from './fixtures'

describe('custoCorrenteReceita (REC-05)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('soma qtde × custo/unidade + gás, dividido pelo rendimento padrão', async () => {
    const leiteCondensado = await criarIngrediente({ nome: 'Leite condensado', unidadeBase: 'g' })
    const compra = await registrarCompra({
      ingredienteId: leiteCondensado.id,
      qtdeEmbalagens: 1,
      tamanhoEmbalagem: 395,
      precoPorEmbalagem: 3.95,
    })
    expect(compra.custoPorUnidadeBase.toFixed(6)).toBe('0.010000')

    const receita = await criarReceita({
      rendimentoPadrao: 20,
      custoGas: 2.0,
      itens: [{ ingredienteId: leiteCondensado.id, qtde: 395 }],
    })

    const { total, porUnidade } = await custoCorrenteReceita(receita.id)

    expect(total.toFixed(4)).toBe('5.9500')
    expect(porUnidade.toFixed(6)).toBe('0.297500')
  })

  it('sem gás, soma só os ingredientes', async () => {
    const leiteCondensado = await criarIngrediente({ nome: 'Leite condensado', unidadeBase: 'g' })
    await registrarCompra({
      ingredienteId: leiteCondensado.id,
      qtdeEmbalagens: 1,
      tamanhoEmbalagem: 395,
      precoPorEmbalagem: 3.95,
    })
    const receita = await criarReceita({
      rendimentoPadrao: 20,
      itens: [{ ingredienteId: leiteCondensado.id, qtde: 395 }],
    })

    const { total } = await custoCorrenteReceita(receita.id)

    expect(total.toFixed(4)).toBe('3.9500')
  })

  it('dízimas repetidas não explodem precisão', async () => {
    const ingredientes = await Promise.all(
      [0, 1, 2].map(async (i) => {
        const ing = await criarIngrediente({ nome: `Dizima ${i} ${Date.now()}` })
        await registrarCompra({
          ingredienteId: ing.id,
          qtdeEmbalagens: 1,
          tamanhoEmbalagem: 1_000_000,
          precoPorEmbalagem: 3,
        })
        return ing
      }),
    )
    const receita = await criarReceita({
      rendimentoPadrao: 1,
      itens: ingredientes.map((ing) => ({ ingredienteId: ing.id, qtde: 333.333 })),
    })

    const { total } = await custoCorrenteReceita(receita.id)

    const esperado = new Decimal('333.333').times('0.000003').times(3)
    expect(total.toFixed(6)).toBe(esperado.toFixed(6))
  })

  it('ingrediente sem compra entra em faltamCompras e não quebra o total', async () => {
    const semCompra = await criarIngrediente({ nome: `Sem compra ${Date.now()}` })
    const receita = await criarReceita({
      rendimentoPadrao: 10,
      itens: [{ ingredienteId: semCompra.id, qtde: 100 }],
    })

    const { total, faltamCompras } = await custoCorrenteReceita(receita.id)

    expect(faltamCompras).toContain(semCompra.nome)
    expect(total.toFixed(4)).toBe('0.0000')
  })
})

describe('ultimasCompras (ING-05 / A2 tie-break)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('usa a compra de data_compra mais recente', async () => {
    const ing = await criarIngrediente({ nome: `Ing A2 data ${Date.now()}` })
    await registrarCompra({
      ingredienteId: ing.id,
      marca: 'Antiga',
      dataCompra: new Date('2026-01-01'),
      precoPorEmbalagem: 5,
    })
    const recente = await registrarCompra({
      ingredienteId: ing.id,
      marca: 'Recente',
      dataCompra: new Date('2026-06-01'),
      precoPorEmbalagem: 9,
    })

    const map = await ultimasCompras([ing.id])

    expect(map.get(ing.id)?.id).toBe(recente.id)
    expect(map.get(ing.id)?.marca).toBe('Recente')
  })

  it('mesma data_compra, desempata por criado_em mais recente', async () => {
    const ing = await criarIngrediente({ nome: `Ing A2 empate ${Date.now()}` })
    const mesmaData = new Date('2026-03-15')
    await registrarCompra({ ingredienteId: ing.id, marca: 'Primeira', dataCompra: mesmaData })
    const segunda = await registrarCompra({ ingredienteId: ing.id, marca: 'Segunda', dataCompra: mesmaData })

    const map = await ultimasCompras([ing.id])

    expect(map.get(ing.id)?.id).toBe(segunda.id)
  })
})

describe('custoCorrenteKit (D-11/D-13)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('custo do kit = soma dos custos por unidade dos componentes × qtde', async () => {
    const ingA = await criarIngrediente({ nome: `Kit ing A ${Date.now()}` })
    await registrarCompra({ ingredienteId: ingA.id, tamanhoEmbalagem: 100, precoPorEmbalagem: 10 }) // 0.1/un
    const receitaA = await criarReceita({
      rendimentoPadrao: 10,
      itens: [{ ingredienteId: ingA.id, qtde: 100 }],
    })
    const produtoA = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaA.id, precoVenda: 5 })

    const ingB = await criarIngrediente({ nome: `Kit ing B ${Date.now()}` })
    await registrarCompra({ ingredienteId: ingB.id, tamanhoEmbalagem: 50, precoPorEmbalagem: 5 }) // 0.1/un
    const receitaB = await criarReceita({
      rendimentoPadrao: 5,
      itens: [{ ingredienteId: ingB.id, qtde: 50 }],
    })
    const produtoB = await criarProduto({ tipo: 'UNITARIO', receitaId: receitaB.id, precoVenda: 3 })

    const { porUnidade: porUnidadeA } = await custoCorrenteReceita(receitaA.id)
    const { porUnidade: porUnidadeB } = await custoCorrenteReceita(receitaB.id)

    const kit = await criarProduto({
      tipo: 'KIT',
      precoVenda: 15,
      kitItens: [
        { componenteId: produtoA.id, componenteVariacaoId: produtoA.variacao!.id, qtde: 2 },
        { componenteId: produtoB.id, componenteVariacaoId: produtoB.variacao!.id, qtde: 1 },
      ],
    })

    const { custo } = await custoCorrenteKit(kit.id)
    const esperado = porUnidadeA.times(2).plus(porUnidadeB.times(1))

    expect(custo.toFixed(6)).toBe(esperado.toFixed(6))
  })
})

describe('margemPercent (A1)', () => {
  it('(preço - custo) / preço × 100', () => {
    expect(margemPercent(new Decimal(10), new Decimal(7)).toFixed(2)).toBe('30.00')
  })

  it('preço <= 0 retorna 0', () => {
    expect(margemPercent(new Decimal(0), new Decimal(7)).toFixed(2)).toBe('0.00')
  })
})

describe('computeLoteSnapshot (congelado, D-06)', () => {
  it('divide pelo rendimento REAL informado, não o padrão', () => {
    const snapshot = computeLoteSnapshot({
      linhas: [
        {
          compra: { id: 'compra-1', marca: 'Marca X', custoPorUnidadeBase: new Decimal('0.01') },
          qtdeUsada: new Decimal(395),
        },
      ],
      custoGas: new Decimal('2.00'),
      rendimentoReal: 18,
    })

    expect(snapshot.custoTotalCongelado).toBe('5.9500')
    const esperadoPorUnidade = new Decimal('5.9500').dividedBy(18)
    expect(snapshot.custoPorUnidadeCongelado).toBe(esperadoPorUnidade.toFixed(6))
  })
})
