import { prisma } from '@/lib/db/client'
import { ItemResgatavelForm } from '@/components/admin/item-resgatavel-form'

export default async function NovoItemResgatavelPage() {
  const [produtosAtivos, config] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true, tipo: 'UNITARIO' },
      select: {
        id: true,
        nome: true,
        variacoes: { where: { ativo: true }, select: { id: true, nome: true, precoVenda: true }, orderBy: { nome: 'asc' } },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])

  const produtos = produtosAtivos.map((p) => ({
    id: p.id,
    nome: p.nome,
    variacoes: p.variacoes.map((v) => ({ id: v.id, nome: v.nome, precoVenda: Number(v.precoVenda) })),
  }))

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Novo item de resgate</h1>
      <ItemResgatavelForm produtos={produtos} pontosPorRealAtual={config ? Number(config.pontosPorReal) : 1} />
    </div>
  )
}
