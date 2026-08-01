import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { CorrigirCompraForm } from '@/components/admin/corrigir-compra-form'

export default async function CorrigirCompraPage({
  params,
}: {
  params: Promise<{ id: string; compraId: string }>
}) {
  const { id, compraId } = await params

  const compra = await prisma.ingredienteCompra.findUnique({ where: { id: compraId } })
  if (!compra || compra.ingredienteId !== id) notFound()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Corrigir compra</h1>
      <CorrigirCompraForm
        compraId={compra.id}
        ingredienteId={id}
        defaults={{
          dataCompra: compra.dataCompra.toISOString().slice(0, 10),
          mercado: compra.mercado,
          marca: compra.marca,
          qtdeEmbalagens: compra.qtdeEmbalagens.toFixed(3),
          tamanhoEmbalagem: compra.tamanhoEmbalagem.toFixed(3),
          precoPorEmbalagem: compra.precoPorEmbalagem.toFixed(4),
        }}
      />
    </div>
  )
}
