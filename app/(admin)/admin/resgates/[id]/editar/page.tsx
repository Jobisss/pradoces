import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { margensCorrentesBatch } from '@/lib/custo/corrente'
import { ItemResgatavelForm } from '@/components/admin/item-resgatavel-form'

export default async function EditarItemResgatavelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [item, produtosAtivos, margens, config] = await Promise.all([
    prisma.itemResgatavel.findUnique({ where: { id } }),
    prisma.produto.findMany({
      where: { ativo: true, tipo: 'UNITARIO' },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    margensCorrentesBatch(),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])
  if (!item) notFound()

  const margensPorId = new Map(margens.map((m) => [m.produtoId, m]))
  const produtos = produtosAtivos.map((p) => {
    const m = margensPorId.get(p.id)
    return {
      id: p.id,
      nome: p.nome,
      precoVenda: m ? Number(m.precoVenda) : null,
      margem: m?.margem ? Number(m.margem) : null,
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Editar item de resgate</h1>
      <ItemResgatavelForm
        produtos={produtos}
        pontosPorRealAtual={config ? Number(config.pontosPorReal) : 1}
        defaults={{
          id: item.id,
          produtoId: item.produtoId,
          nomeCustom: item.nomeCustom,
          custoPontos: item.custoPontos,
          ativo: item.ativo,
        }}
      />
    </div>
  )
}
