import { prisma } from '@/lib/db/client'
import { custosCorrentesReceitas } from '@/lib/custo/corrente'
import { ProdutoForm } from '@/components/admin/produto-form'

export default async function NovoProdutoPage() {
  const [receitasRaw, unitariosRaw, config] = await Promise.all([
    prisma.receita.findMany({
      where: { produto: null },
      include: { itens: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.produto.findMany({
      where: { tipo: 'UNITARIO' },
      include: { receita: { include: { itens: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])

  const todasReceitas = [
    ...receitasRaw,
    ...unitariosRaw.flatMap((p) => (p.receita ? [p.receita] : [])),
  ]
  const custos = await custosCorrentesReceitas(todasReceitas)

  const receitas = receitasRaw.map((r) => {
    const custo = custos.get(r.id)!
    return {
      id: r.id,
      nome: r.nome,
      custoPorUnidade: custo.faltamCompras.length > 0 && custo.total.isZero() ? null : custo.porUnidade.toFixed(6),
    }
  })

  const unitarios = unitariosRaw
    .filter((p) => p.receitaId)
    .map((p) => {
      const custo = custos.get(p.receitaId!)!
      return {
        id: p.id,
        nome: p.nome,
        custoPorUnidade: custo.faltamCompras.length > 0 && custo.total.isZero() ? null : custo.porUnidade.toFixed(6),
      }
    })

  const margemMinimaGlobal = config ? config.margemMinimaPadrao.toFixed(2) : '30.00'

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold">Novo produto</h1>
      <ProdutoForm receitas={receitas} unitarios={unitarios} margemMinimaGlobal={margemMinimaGlobal} />
    </div>
  )
}
