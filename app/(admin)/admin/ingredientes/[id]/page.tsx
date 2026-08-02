import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { CompraAcoes } from '@/components/admin/compra-acoes'
import { dataCivilFmtBR as dateFmt } from '@/lib/format/date'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function IngredienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const ingrediente = await prisma.ingrediente.findUnique({ where: { id } })
  if (!ingrediente) notFound()

  const compras = await prisma.ingredienteCompra.findMany({
    where: { ingredienteId: id },
    orderBy: [{ dataCompra: 'desc' }, { criadoEm: 'desc' }],
    include: { _count: { select: { usos: true } } },
  })

  const ultima = compras[0]

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">{ingrediente.nome}</h1>

      {ultima && (
        <p className="tabular-nums text-base">
          Última compra: {ultima.marca}, {currency.format(ultima.precoTotal.toNumber())} (
          {currency.format(ultima.custoPorUnidadeBase.toNumber())}/{ingrediente.unidadeBase}) em{' '}
          {dateFmt.format(ultima.dataCompra)}
        </p>
      )}

      <h2 className="text-lg font-semibold">Compras desse ingrediente</h2>

      {compras.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base font-medium">Nenhuma compra registrada ainda</p>
          <p className="text-sm text-muted-foreground">
            Toca em &ldquo;Fui ao mercado&rdquo; na tela inicial pra registrar a primeira.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {compras.map((compra) => (
            <li key={compra.id} className="space-y-2 py-3">
              <p className="tabular-nums text-sm">
                {dateFmt.format(compra.dataCompra)} · {compra.marca} · {compra.mercado} ·{' '}
                {compra.qtdeEmbalagens.toFixed(0)} × {compra.tamanhoEmbalagem.toFixed(0)}
                {ingrediente.unidadeBase} · {currency.format(compra.precoTotal.toNumber())}
              </p>
              {compra._count.usos > 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lock className="size-4" aria-hidden />
                  Usada num lote — não dá mais pra mudar
                </p>
              ) : (
                <CompraAcoes
                  compraId={compra.id}
                  editHref={`/admin/ingredientes/${id}/compras/${compra.id}/corrigir`}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Link href={`/admin/ingredientes/${id}/editar`} className="text-sm underline underline-offset-2">
        Editar ingrediente
      </Link>
    </div>
  )
}
