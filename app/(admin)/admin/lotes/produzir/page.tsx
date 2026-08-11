import { prisma } from '@/lib/db/client'
import { ProduzirLoteForm } from '@/components/admin/produzir-lote-form'

/** D-13 — produto-cêntrico ("vou fazer o Brownie"), não mais receita-cêntrico. */
export default async function ProduzirLotePage() {
  const [produtos, totalProdutosUnitarios] = await Promise.all([
    prisma.produto.findMany({
      where: { tipo: 'UNITARIO', receitaId: { not: null }, variacoes: { some: { ativo: true } } },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.produto.count({ where: { tipo: 'UNITARIO' } }),
  ])

  const opcoes = produtos.map((p) => ({ produtoId: p.id, nome: p.nome }))

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold">Produzi hoje</h1>
      {opcoes.length === 0 && totalProdutosUnitarios > 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum produto com variação ativa ainda — cadastra o produto (com pelo menos 1 variação) primeiro.
        </p>
      )}
      <ProduzirLoteForm produtos={opcoes} />
    </div>
  )
}
