import Link from 'next/link'
import { prisma } from '@/lib/db/client'
import { custosCorrentesReceitas } from '@/lib/custo/corrente'
import { Button } from '@/components/ui/button'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Lista de receitas com custo/un em batch (Pitfall 9 — nunca calcular custo
 * por receita dentro do loop; sempre a versão em lote de lib/custo/corrente).
 */
export default async function ReceitasPage() {
  const receitas = await prisma.receita.findMany({
    include: { itens: { include: { ingrediente: true } }, produto: { select: { nome: true } } },
    orderBy: { nome: 'asc' },
  })

  const custos = await custosCorrentesReceitas(receitas)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Receitas</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/receitas/nova">Nova receita</Link>
        </Button>
      </div>

      {receitas.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base font-medium">Nenhuma receita ainda</p>
          <p className="text-sm text-muted-foreground">
            A receita diz quanto de cada ingrediente vai num lote — é com ela que a gente calcula o
            custo de cada doce.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {receitas.map((receita) => {
            const custo = custos.get(receita.id)!
            return (
              <li key={receita.id} className="space-y-1 py-4">
                <Link
                  href={`/admin/receitas/${receita.id}/editar`}
                  className="text-base font-medium underline-offset-2 hover:underline"
                >
                  {receita.nome}
                </Link>
                <p className="tabular-nums text-sm text-muted-foreground">
                  Custo do lote hoje: {currency.format(custo.total.toNumber())} ·{' '}
                  {currency.format(custo.porUnidade.toNumber())} por unidade
                </p>
                <p className="text-xs text-muted-foreground">
                  Rende {receita.rendimentoPadrao} unidades
                  {receita.produto ? ` · ${receita.produto.nome}` : ''}
                </p>
                {custo.faltamCompras.map((nome) => (
                  <p key={nome} className="text-xs text-muted-foreground">
                    {nome} ainda não tem compra registrada — o custo fica incompleto até você
                    registrar uma.
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
