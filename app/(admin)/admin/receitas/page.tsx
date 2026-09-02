import Link from 'next/link'
import { BookOpen, TriangleAlert } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { custosCorrentesReceitas } from '@/lib/custo/corrente'
import { Button } from '@/components/ui/button'
import { PageHeader, RowCard, ColHead, Chip, EmptyState } from '@/components/admin/ui'

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
  const incompletas = receitas.filter((r) => (custos.get(r.id)?.faltamCompras.length ?? 0) > 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receitas"
        subtitle={
          receitas.length === 0
            ? 'Nenhuma receita cadastrada ainda'
            : `${receitas.length} receita${receitas.length === 1 ? '' : 's'}${incompletas > 0 ? ` · ${incompletas} com custo incompleto` : ' · todas com custo fechado'}`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/receitas/nova">Nova receita</Link>
        </Button>
      </PageHeader>

      {receitas.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhuma receita ainda"
          description="A receita diz quanto de cada ingrediente vai num lote — é com ela que a gente calcula o custo de cada doce."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/receitas/nova">Criar a primeira</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          <ColHead
            cols={[
              { label: 'Receita', className: 'w-[320px]' },
              { label: 'Rende', className: 'w-[110px]' },
              { label: 'Custo do lote hoje', className: 'w-[160px]' },
              { label: 'Custo por unidade', className: 'flex-1' },
            ]}
          />

          <ul className="space-y-2.5">
            {receitas.map((receita) => {
              const custo = custos.get(receita.id)!
              const incompleta = custo.faltamCompras.length > 0
              return (
                <li key={receita.id}>
                  <RowCard>
                    <div className="flex min-w-0 items-center gap-3.5 md:w-[320px]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
                        <BookOpen className="size-5 text-caramelo" aria-hidden />
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <Link
                          href={`/admin/receitas/${receita.id}/editar`}
                          className="block text-[15px] font-semibold underline-offset-2 hover:underline"
                        >
                          {receita.nome}
                        </Link>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {receita.produto ? receita.produto.nome : 'sem produto ligado'} ·{' '}
                          {receita.itens.length} ingrediente{receita.itens.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="w-[110px] shrink-0">
                      <p className="text-sm tabular-nums">{receita.rendimentoPadrao} un</p>
                      <p className="text-xs text-muted-foreground md:hidden">rende</p>
                    </div>

                    <div className="w-[160px] shrink-0">
                      <p className="text-[15px] font-semibold tabular-nums">
                        {currency.format(custo.total.toNumber())}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">custo do lote</p>
                    </div>

                    <div className="min-w-[220px] flex-1">
                      <p className="text-[15px] font-semibold tabular-nums">
                        {currency.format(custo.porUnidade.toNumber())}
                        <span className="text-[13px] font-normal text-muted-foreground"> por unidade</span>
                      </p>
                      {incompleta && (
                        <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-warn">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {custo.faltamCompras.join(', ')} sem compra registrada — o custo fica
                          incompleto até você registrar uma
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {incompleta && (
                        <Chip tone="warn" icon={TriangleAlert}>
                          Custo incompleto
                        </Chip>
                      )}
                      <Button asChild variant="outline" className="h-10">
                        <Link href={`/admin/receitas/${receita.id}/editar`}>Editar</Link>
                      </Button>
                    </div>
                  </RowCard>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
