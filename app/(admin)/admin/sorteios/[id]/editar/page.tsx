import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { SorteioForm } from '@/components/admin/sorteio-form'

/** "YYYY-MM-DDTHH:mm" em America/Sao_Paulo — <input type="datetime-local"> não
 * entende timezone, então formatar em UTC (o padrão de toISOString) mostraria
 * a hora errada pra quem tá em Brasília. */
function paraDatetimeLocalSaoPaulo(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data)
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}`
}

export default async function EditarSorteioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sorteio = await prisma.sorteio.findUnique({ where: { id } })
  if (!sorteio) notFound()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Editar sorteio</h1>
      <SorteioForm
        defaults={{
          id: sorteio.id,
          nome: sorteio.nome,
          premio: sorteio.premio,
          custoPontos: sorteio.custoPontos,
          capPorCliente: sorteio.capPorCliente,
          prazo: paraDatetimeLocalSaoPaulo(sorteio.prazo),
        }}
      />
    </div>
  )
}
