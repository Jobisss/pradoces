import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

/**
 * Phase 2 (motor financeiro) schema smoke test — 02-01-PLAN.md Task 3.
 *
 * Proves the invariants that live in the DATABASE (not app convention) are
 * real against the live Postgres, not just present in the migration file:
 *   - ING-07/D-03: trg_compra_imutavel blocks UPDATE/DELETE on a compra once
 *     a lote references it (via lote_uso_ingredientes.ingrediente_compra_id).
 *   - D-03: a compra NOT yet referenced by any lote stays editable/deletable.
 *   - LOTE-04: qtde_disponivel/qtde_reservada CHECK >= 0 aborts negative UPDATEs.
 *   - D-10: configuracoes is a true singleton (CHECK id = 1).
 *   - The trigger itself is visible in pg_trigger (catalog proof, not app-level).
 *
 * No fixtures here (tests/financeiro/fixtures.ts is born in Plan 02-03) — the
 * chain is built directly via prisma.* calls, Decimal fields passed as strings
 * (Pitfall 4 / Pitfall 8: never Number()/toBe(number) with money).
 */
describe('Phase 2 schema — custo congelado enforcement (live Postgres)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  /** Ingrediente -> compra -> receita -> produto -> lote -> loteUsoIngrediente. */
  async function criarCadeiaCompleta() {
    const ingrediente = await prisma.ingrediente.create({
      data: { nome: 'Leite condensado', unidadeBase: 'g' },
    })
    const compra = await prisma.ingredienteCompra.create({
      data: {
        ingredienteId: ingrediente.id,
        dataCompra: new Date('2026-07-01'),
        mercado: 'Mercado Vizinho',
        marca: 'Moça',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '395',
        precoPorEmbalagem: '3.95',
        qtdeTotalBase: '395',
        precoTotal: '3.95',
        custoPorUnidadeBase: '0.010000',
      },
    })
    const receita = await prisma.receita.create({
      data: {
        nome: 'Brigadeiro',
        rendimentoPadrao: 20,
        itens: {
          create: [{ ingredienteId: ingrediente.id, qtde: '395' }],
        },
      },
    })
    const produto = await prisma.produto.create({
      data: {
        nome: 'Brigadeiro',
        descricao: 'Brigadeiro tradicional feito com leite condensado',
        categoria: 'Doces',
        tipo: 'UNITARIO',
        precoVenda: '2.50',
        receitaId: receita.id,
      },
    })
    const lote = await prisma.lote.create({
      data: {
        produtoId: produto.id,
        receitaId: receita.id,
        multiplicador: '1',
        rendimentoReal: 20,
        validade: new Date('2026-07-08'),
        qtdeDisponivel: 20,
        qtdeReservada: 0,
        custoGasCongelado: '0',
        custoTotalCongelado: '3.95',
        custoPorUnidadeCongelado: '0.197500',
        usos: {
          create: [
            {
              ingredienteCompraId: compra.id,
              qtdeUsada: '395',
              marcaSnapshot: compra.marca,
              custoUnitarioCongelado: compra.custoPorUnidadeBase.toFixed(6),
              custoCongelado: '3.95',
            },
          ],
        },
      },
    })
    return { ingrediente, compra, receita, produto, lote }
  }

  it('ING-07: UPDATE numa compra referenciada por lote rejeita (compra imutável)', async () => {
    const { compra } = await criarCadeiaCompleta()
    await expect(
      prisma.ingredienteCompra.update({
        where: { id: compra.id },
        data: { precoPorEmbalagem: '9.99' },
      }),
    ).rejects.toThrow(/imutavel/)
  })

  it('ING-07: DELETE numa compra referenciada por lote rejeita (compra imutável)', async () => {
    const { compra } = await criarCadeiaCompleta()
    await expect(prisma.ingredienteCompra.delete({ where: { id: compra.id } })).rejects.toThrow(
      /imutavel/,
    )
  })

  it('D-03: compra NÃO referenciada por nenhum lote aceita update e delete normalmente', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: { nome: 'Açúcar refinado', unidadeBase: 'g' },
    })
    const compra = await prisma.ingredienteCompra.create({
      data: {
        ingredienteId: ingrediente.id,
        dataCompra: new Date('2026-07-01'),
        mercado: 'Mercado Vizinho',
        marca: 'União',
        qtdeEmbalagens: '1',
        tamanhoEmbalagem: '1000',
        precoPorEmbalagem: '5.00',
        qtdeTotalBase: '1000',
        precoTotal: '5.00',
        custoPorUnidadeBase: '0.005000',
      },
    })

    const updated = await prisma.ingredienteCompra.update({
      where: { id: compra.id },
      data: { precoPorEmbalagem: '5.50' },
    })
    expect(updated.precoPorEmbalagem.toFixed(4)).toBe('5.5000')

    await expect(
      prisma.ingredienteCompra.delete({ where: { id: compra.id } }),
    ).resolves.toBeDefined()
  })

  it('LOTE-04: UPDATE que negativa qtde_disponivel aborta (CHECK)', async () => {
    const { lote } = await criarCadeiaCompleta()
    await expect(
      prisma.$executeRaw`UPDATE lotes SET qtde_disponivel = -1 WHERE id = ${lote.id}::uuid`,
    ).rejects.toThrow()
  })

  it('LOTE-04: UPDATE que negativa qtde_reservada aborta (CHECK)', async () => {
    const { lote } = await criarCadeiaCompleta()
    await expect(
      prisma.$executeRaw`UPDATE lotes SET qtde_reservada = -1 WHERE id = ${lote.id}::uuid`,
    ).rejects.toThrow()
  })

  it('D-10: INSERT em configuracoes com id != 1 rejeita (singleton CHECK)', async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO configuracoes (id, margem_minima_padrao) VALUES (2, 30)`,
    ).rejects.toThrow()
  })

  it('catálogo: trigger trg_compra_imutavel existe no Postgres vivo (não só no migration.sql)', async () => {
    const rows = await prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_compra_imutavel'
    `
    expect(rows).toHaveLength(1)
  })
})
