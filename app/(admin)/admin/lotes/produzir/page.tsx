import { prisma } from '@/lib/db/client'
import { ProduzirLoteForm } from '@/components/admin/produzir-lote-form'

export default async function ProduzirLotePage() {
  const [receitasComProduto, totalReceitas] = await Promise.all([
    prisma.receita.findMany({
      where: { produto: { isNot: null } },
      include: { produto: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.receita.count(),
  ])

  const opcoes = receitasComProduto.map((r) => ({
    receitaId: r.id,
    produtoId: r.produto!.id,
    nome: r.nome,
  }))

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold">Produzi hoje</h1>
      {opcoes.length === 0 && totalReceitas > 0 && (
        <p className="text-sm text-muted-foreground">
          Essa receita ainda não tem produto — cadastra o produto primeiro.
        </p>
      )}
      <ProduzirLoteForm receitas={opcoes} />
    </div>
  )
}
