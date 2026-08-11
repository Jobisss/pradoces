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
      select: {
        id: true,
        nome: true,
        variacoes: { where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } },
      },
      orderBy: { nome: 'asc' },
    }),
    margensCorrentesBatch(),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])
  if (!item) notFound()

  const margemPorVariacaoId = new Map(margens.filter((m) => m.variacaoId).map((m) => [m.variacaoId!, m]))
  const produtos = produtosAtivos.map((p) => ({
    id: p.id,
    nome: p.nome,
    variacoes: p.variacoes.map((v) => {
      const m = margemPorVariacaoId.get(v.id)
      return {
        id: v.id,
        nome: v.nome,
        precoVenda: m ? Number(m.precoVenda) : null,
        margem: m?.margem ? Number(m.margem) : null,
      }
    }),
  }))

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Editar item de resgate</h1>
      <ItemResgatavelForm
        produtos={produtos}
        pontosPorRealAtual={config ? Number(config.pontosPorReal) : 1}
        defaults={{
          id: item.id,
          produtoId: item.produtoId,
          variacaoId: item.variacaoId,
          nomeCustom: item.nomeCustom,
          custoPontos: item.custoPontos,
          ativo: item.ativo,
        }}
      />
    </div>
  )
}
