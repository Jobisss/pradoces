import { randomUUID } from 'node:crypto'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db/client'
import { ultimasCompras } from '@/lib/custo/corrente'
import { computeLoteSnapshot } from '@/lib/custo/congelado'

/**
 * Factories do domínio financeiro (estilo tests/conftest.ts) — usam prisma
 * direto + lib/custo, NÃO Server Actions (ainda não existem nos planos
 * 02-04..07). `produzirLote` espelha fielmente o que a action do 02-07 fará:
 * carrega itens da receita, resolve ultimasCompras, escala pelo
 * multiplicador, congela via computeLoteSnapshot, insere com nested create.
 *
 * D-13: `criarProduto` UNITARIO cria automaticamente 1 Variação "Padrão" com
 * o `precoVenda`/`recheioReceitaId`/`recheioGramasUsadas` passados — a
 * maioria dos testes existentes só se importa com "o produto tem um preço e
 * (talvez) um recheio", não com múltiplas variações, então isso evita
 * reescrever cada chamada. Testes que precisam de mais de 1 variação chamam
 * `criarVariacao` direto.
 */

export async function criarIngrediente(opts?: {
  nome?: string
  unidadeBase?: 'g' | 'ml' | 'un'
  tipo?: 'INGREDIENTE' | 'EMBALAGEM'
}) {
  return prisma.ingrediente.create({
    data: {
      nome: opts?.nome ?? `Ingrediente ${randomUUID().slice(0, 8)}`,
      unidadeBase: opts?.unidadeBase ?? 'g',
      tipo: opts?.tipo ?? 'INGREDIENTE',
    },
  })
}

export async function registrarCompra(opts: {
  ingredienteId: string
  marca?: string
  mercado?: string
  dataCompra?: Date
  qtdeEmbalagens?: Decimal.Value
  tamanhoEmbalagem?: Decimal.Value
  precoPorEmbalagem?: Decimal.Value
}) {
  const qtdeEmbalagens = new Decimal(opts.qtdeEmbalagens ?? 1)
  const tamanhoEmbalagem = new Decimal(opts.tamanhoEmbalagem ?? 100)
  const precoPorEmbalagem = new Decimal(opts.precoPorEmbalagem ?? 10)

  const qtdeTotalBase = qtdeEmbalagens.times(tamanhoEmbalagem)
  const precoTotal = qtdeEmbalagens.times(precoPorEmbalagem)
  const custoPorUnidadeBase = precoTotal.dividedBy(qtdeTotalBase)

  return prisma.ingredienteCompra.create({
    data: {
      ingredienteId: opts.ingredienteId,
      marca: opts.marca ?? 'Marca Teste',
      mercado: opts.mercado ?? 'Mercado Teste',
      dataCompra: opts.dataCompra ?? new Date(),
      qtdeEmbalagens: qtdeEmbalagens.toFixed(3),
      tamanhoEmbalagem: tamanhoEmbalagem.toFixed(3),
      precoPorEmbalagem: precoPorEmbalagem.toFixed(4),
      qtdeTotalBase: qtdeTotalBase.toFixed(3),
      precoTotal: precoTotal.toFixed(4),
      custoPorUnidadeBase: custoPorUnidadeBase.toFixed(6),
    },
  })
}

export async function criarReceita(opts: {
  nome?: string
  rendimentoPadrao?: number
  custoGas?: Decimal.Value | null
  validadeDias?: number
  itens: Array<{ ingredienteId: string; qtde: Decimal.Value }>
}) {
  return prisma.receita.create({
    data: {
      nome: opts.nome ?? `Receita ${randomUUID().slice(0, 8)}`,
      rendimentoPadrao: opts.rendimentoPadrao ?? 20,
      custoGas: opts.custoGas != null ? new Decimal(opts.custoGas).toFixed(4) : null,
      validadeDias: opts.validadeDias,
      itens: {
        create: opts.itens.map((item) => ({
          ingredienteId: item.ingredienteId,
          qtde: new Decimal(item.qtde).toFixed(3),
        })),
      },
    },
  })
}

export async function criarVariacao(opts: {
  produtoId: string
  nome?: string
  precoVenda?: Decimal.Value
  recheioReceitaId?: string
  recheioGramasUsadas?: Decimal.Value
  margemMinimaOverride?: Decimal.Value | null
  ativo?: boolean
}) {
  return prisma.variacao.create({
    data: {
      produtoId: opts.produtoId,
      nome: opts.nome ?? 'Padrão',
      precoVenda: new Decimal(opts.precoVenda ?? 10).toFixed(4),
      recheioReceitaId: opts.recheioReceitaId,
      recheioGramasUsadas: opts.recheioGramasUsadas != null ? new Decimal(opts.recheioGramasUsadas).toFixed(3) : null,
      margemMinimaOverride:
        opts.margemMinimaOverride != null ? new Decimal(opts.margemMinimaOverride).toFixed(2) : null,
      ativo: opts.ativo ?? true,
    },
  })
}

export async function criarProduto(opts?: {
  nome?: string
  tipo?: 'UNITARIO' | 'KIT'
  precoVenda?: Decimal.Value
  receitaId?: string
  categoria?: string
  descricao?: string
  margemMinimaOverride?: Decimal.Value | null
  kitItens?: Array<{ componenteId: string; componenteVariacaoId: string; qtde: number }>
  // D-13 — só usados pra UNITARIO, viram a Variação "Padrão" auto-criada.
  recheioReceitaId?: string
  recheioGramasUsadas?: Decimal.Value
  variacaoNome?: string
}) {
  const tipo = opts?.tipo ?? 'UNITARIO'

  const produto = await prisma.produto.create({
    data: {
      nome: opts?.nome ?? `Produto ${randomUUID().slice(0, 8)}`,
      descricao: opts?.descricao ?? 'Descrição de teste',
      categoria: opts?.categoria ?? 'Categoria Teste',
      tipo,
      precoVenda: tipo === 'KIT' ? new Decimal(opts?.precoVenda ?? 10).toFixed(4) : null,
      margemMinimaOverride:
        tipo === 'KIT' && opts?.margemMinimaOverride != null
          ? new Decimal(opts.margemMinimaOverride).toFixed(2)
          : null,
      receitaId: opts?.receitaId,
      kitItens: opts?.kitItens
        ? {
            create: opts.kitItens.map((item) => ({
              componenteId: item.componenteId,
              componenteVariacaoId: item.componenteVariacaoId,
              qtde: item.qtde,
            })),
          }
        : undefined,
    },
  })

  if (tipo === 'UNITARIO') {
    const variacao = await criarVariacao({
      produtoId: produto.id,
      nome: opts?.variacaoNome,
      precoVenda: opts?.precoVenda,
      recheioReceitaId: opts?.recheioReceitaId,
      recheioGramasUsadas: opts?.recheioGramasUsadas,
      margemMinimaOverride: opts?.margemMinimaOverride,
    })
    return { ...produto, variacao }
  }

  return { ...produto, variacao: null }
}

export async function produzirLote(opts: {
  receitaId: string
  produtoId: string
  variacaoId?: string
  multiplicador?: Decimal.Value
  rendimentoReal: number
  validade?: Date
}) {
  const multiplicador = new Decimal(opts.multiplicador ?? 1)

  const receita = await prisma.receita.findUniqueOrThrow({
    where: { id: opts.receitaId },
    include: { itens: true },
  })

  // Se não veio variacaoId explícito, usa a Variação "Padrão" do produto
  // (criarProduto UNITARIO sempre cria uma) — evita quebrar as várias
  // chamadas existentes que só passavam produtoId/receitaId.
  const variacaoId =
    opts.variacaoId ??
    (await prisma.variacao.findFirstOrThrow({ where: { produtoId: opts.produtoId } })).id

  const ultimas = await ultimasCompras(receita.itens.map((item) => item.ingredienteId))

  const linhas = receita.itens.map((item) => {
    const ultima = ultimas.get(item.ingredienteId)
    if (!ultima) {
      throw new Error(`produzirLote fixture: sem compra para ingrediente ${item.ingredienteId}`)
    }
    return {
      compra: { id: ultima.id, marca: ultima.marca, custoPorUnidadeBase: ultima.custoPorUnidadeBase },
      qtdeUsada: new Decimal(item.qtde).times(multiplicador),
    }
  })

  const snapshot = computeLoteSnapshot({
    linhas,
    custoGas: receita.custoGas ? new Decimal(receita.custoGas) : new Decimal(0),
    rendimentoReal: opts.rendimentoReal,
  })

  const validadeDias = receita.validadeDias ?? 7
  const validade = opts.validade ?? new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000)

  return prisma.lote.create({
    data: {
      produtoId: opts.produtoId,
      variacaoId,
      receitaId: opts.receitaId,
      multiplicador: multiplicador.toFixed(2),
      rendimentoReal: opts.rendimentoReal,
      validade,
      qtdeDisponivel: opts.rendimentoReal,
      custoGasCongelado: snapshot.custoGasCongelado,
      custoTotalCongelado: snapshot.custoTotalCongelado,
      custoPorUnidadeCongelado: snapshot.custoPorUnidadeCongelado,
      usos: {
        create: snapshot.usos.map((uso) => ({
          ingredienteCompraId: uso.ingredienteCompraId,
          qtdeUsada: uso.qtdeUsada,
          marcaSnapshot: uso.marcaSnapshot,
          custoUnitarioCongelado: uso.custoUnitarioCongelado,
          custoCongelado: uso.custoCongelado,
        })),
      },
    },
    include: { usos: true },
  })
}
