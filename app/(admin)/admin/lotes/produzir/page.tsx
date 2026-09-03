import { prisma } from '@/lib/db/client'
import { ProduzirLoteForm } from '@/components/admin/produzir-lote-form'
import { PageHeader } from '@/components/admin/ui'
import { FormAlert } from '@/components/admin/form'

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
    <div className="space-y-6">
      <PageHeader
        title="Produzi hoje"
        subtitle="Registra o que saiu do forno — o custo de hoje fica congelado nesse lote pra sempre"
      />
      {opcoes.length === 0 && totalProdutosUnitarios > 0 && (
        <FormAlert
          title="Nenhum produto pronto pra produzir"
          detail="Todo produto aqui precisa de uma receita e de pelo menos uma variação ativa. Edita o produto antes."
        />
      )}
      <ProduzirLoteForm produtos={opcoes} />
    </div>
  )
}
