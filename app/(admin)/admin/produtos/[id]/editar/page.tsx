import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { custosCorrentesReceitas, pesoTotalGramasReceita } from '@/lib/custo/corrente'
import { ProdutoForm } from '@/components/admin/produto-form'

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const produto = await prisma.produto.findUnique({
    where: { id },
    include: { kitItens: true, fotos: { orderBy: { ordem: 'asc' } }, campanhas: true },
  })
  if (!produto) notFound()

  const [receitasDisponiveisRaw, todasReceitasRaw, unitariosRaw, config] = await Promise.all([
    prisma.receita.findMany({
      where: { OR: [{ produto: null }, { produto: { id } }] },
      include: { itens: true },
      orderBy: { nome: 'asc' },
    }),
    // Recheio não é @unique — qualquer receita serve, mesmo já usada como base de outro produto.
    // Precisa de ingrediente.unidadeBase pra pesoTotalGramasReceita (rateio do recheio por grama).
    prisma.receita.findMany({
      include: { itens: { include: { ingrediente: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.produto.findMany({
      where: { tipo: 'UNITARIO', id: { not: id } },
      include: { receita: { include: { itens: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])

  const todasReceitas = [
    ...todasReceitasRaw,
    ...unitariosRaw.flatMap((p) => (p.receita ? [p.receita] : [])),
  ]
  const custos = await custosCorrentesReceitas(todasReceitas)

  function serializar(r: { id: string; nome: string }) {
    const custo = custos.get(r.id)!
    return {
      id: r.id,
      nome: r.nome,
      custoPorUnidade: custo.faltamCompras.length > 0 && custo.total.isZero() ? null : custo.porUnidade.toFixed(6),
    }
  }

  const receitas = receitasDisponiveisRaw.map(serializar)
  const recheios = todasReceitasRaw.map((r) => {
    const custo = custos.get(r.id)!
    const { pesoTotalG, itensForaDeGramas } = pesoTotalGramasReceita(r.itens)
    const semCusto = custo.faltamCompras.length > 0 && custo.total.isZero()
    return {
      id: r.id,
      nome: r.nome,
      custoPorGrama: !semCusto && !pesoTotalG.isZero() ? custo.total.dividedBy(pesoTotalG).toFixed(6) : null,
      pesoTotalG: pesoTotalG.toFixed(3),
      itensForaDeGramas,
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
      <h1 className="font-display text-3xl font-semibold">Editar produto</h1>
      <ProdutoForm
        receitas={receitas}
        recheios={recheios}
        unitarios={unitarios}
        margemMinimaGlobal={margemMinimaGlobal}
        defaults={{
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          categoria: produto.categoria,
          tipo: produto.tipo,
          ativo: produto.ativo,
          alergenicos: produto.alergenicos,
          campanhas: produto.campanhas.map((c) => c.campanhaId),
          precoVenda: produto.precoVenda.toFixed(4),
          margemMinimaOverride: produto.margemMinimaOverride ? produto.margemMinimaOverride.toFixed(2) : null,
          receitaId: produto.receitaId,
          recheioReceitaId: produto.recheioReceitaId,
          recheioGramasUsadas: produto.recheioGramasUsadas ? produto.recheioGramasUsadas.toFixed(3) : null,
          kitItens: produto.kitItens.map((i) => ({ componenteId: i.componenteId, qtde: i.qtde })),
          fotos: produto.fotos.map((f) => ({ id: f.id, path: f.path, ordem: f.ordem })),
        }}
      />
    </div>
  )
}
