/**
 * Backfill de Variação (D-13) — roda como parte do MESMO deploy da migration
 * `variacao_produto`, ANTES do app novo começar a servir tráfego. Sem isso,
 * todo produto UNITARIO pré-existente fica sem nenhuma Variação, e a tela de
 * produção/edição, o kit e o resgate ficam quebrados pra eles.
 *
 * Idempotente: produto que já tem qualquer Variação é pulado — seguro rodar
 * de novo (ex.: reexecutar depois de uma falha no meio do caminho).
 *
 *   pnpm tsx --env-file=.env scripts/backfill-variacoes.ts
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '@/lib/db/client'

export async function backfillVariacoes(): Promise<{
  variacoesCriadas: number
  lotesAtualizados: number
  kitItensAtualizados: number
  itensResgataveisAtualizados: number
}> {
  const produtos = await prisma.produto.findMany({
    where: { tipo: 'UNITARIO', variacoes: { none: {} } },
    select: {
      id: true,
      precoVenda: true,
      margemMinimaOverride: true,
      recheioReceitaId: true,
      recheioGramasUsadas: true,
      ativo: true,
    },
  })

  let variacoesCriadas = 0
  let lotesAtualizados = 0
  let kitItensAtualizados = 0
  let itensResgataveisAtualizados = 0

  for (const produto of produtos) {
    if (produto.precoVenda === null) {
      // Não deveria acontecer em produto pré-existente (preco_venda era
      // NOT NULL antes dessa migration) — trava explícito em vez de criar
      // uma Variação sem preço.
      console.error(`Produto ${produto.id} sem precoVenda — pula, corrige manualmente.`)
      continue
    }

    await prisma.$transaction(async (tx) => {
      const variacao = await tx.variacao.create({
        data: {
          produtoId: produto.id,
          nome: 'Padrão',
          recheioReceitaId: produto.recheioReceitaId,
          recheioGramasUsadas: produto.recheioGramasUsadas,
          precoVenda: produto.precoVenda!,
          margemMinimaOverride: produto.margemMinimaOverride,
          ativo: produto.ativo,
        },
      })
      variacoesCriadas += 1

      // SQL cru nesses dois: o schema Prisma já declara variacao_id/
      // componente_variacao_id como NOT NULL (estado pós-migration 2), mas
      // este script roda ENTRE as duas migrations, quando as colunas ainda
      // aceitam NULL. O client tipado não consegue expressar `IS NULL` aqui.
      lotesAtualizados += await tx.$executeRaw`
        UPDATE "lotes" SET "variacao_id" = ${variacao.id}::uuid
        WHERE "produto_id" = ${produto.id}::uuid AND "variacao_id" IS NULL
      `

      // Kit: qualquer ProdutoKitItem cujo componenteId é ESSE produto ganha
      // essa Variação "Padrão" como componenteVariacaoId.
      kitItensAtualizados += await tx.$executeRaw`
        UPDATE "produto_kit_items" SET "componente_variacao_id" = ${variacao.id}::uuid
        WHERE "componente_id" = ${produto.id}::uuid AND "componente_variacao_id" IS NULL
      `

      // Resgate: qualquer ItemResgatavel apontando pra esse produto ganha a
      // Variação "Padrão".
      const itensResgataveis = await tx.itemResgatavel.updateMany({
        where: { produtoId: produto.id, variacaoId: null },
        data: { variacaoId: variacao.id },
      })
      itensResgataveisAtualizados += itensResgataveis.count
    })
  }

  console.log(
    `Backfill: ${variacoesCriadas} variação(ões) "Padrão" criada(s), ` +
      `${lotesAtualizados} lote(s), ${kitItensAtualizados} item(ns) de kit, ` +
      `${itensResgataveisAtualizados} item(ns) de resgate atualizados.`,
  )
  return { variacoesCriadas, lotesAtualizados, kitItensAtualizados, itensResgataveisAtualizados }
}

async function main(): Promise<void> {
  await backfillVariacoes()
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => {
      void prisma.$disconnect()
    })
}
