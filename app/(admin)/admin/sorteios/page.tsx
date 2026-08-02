import Link from 'next/link'
import { prisma } from '@/lib/db/client'
import { datetimeFmtBR } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/** SORT-01/02/07 — lista de sorteios, admin. */
export default async function SorteiosPage() {
  const sorteios = await prisma.sorteio.findMany({
    include: { vencedor: { select: { name: true } }, _count: { select: { chances: true } } },
    orderBy: { criadoEm: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Sorteios</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/sorteios/novo">Novo sorteio</Link>
        </Button>
      </div>

      {sorteios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum sorteio ainda.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sorteios.map((s) => (
            <li key={s.id} className="space-y-1 py-3">
              <div className="flex items-center gap-2">
                {s.status === 'ABERTO' ? (
                  <Link
                    href={`/admin/sorteios/${s.id}/editar`}
                    className="text-base font-medium underline-offset-2 hover:underline"
                  >
                    {s.nome}
                  </Link>
                ) : (
                  <span className="text-base font-medium">{s.nome}</span>
                )}
                <Badge variant={s.status === 'ABERTO' ? 'default' : 'secondary'}>
                  {s.status === 'ABERTO' ? 'Aberto' : 'Encerrado'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {s.premio} · {s.custoPontos} pts/chance · {s._count.chances} chance(s) vendida(s)
              </p>
              <p className="text-sm text-muted-foreground">
                {s.status === 'ABERTO'
                  ? `Encerra em ${datetimeFmtBR.format(s.prazo)}`
                  : `Vencedor: ${s.vencedor?.name ?? '—'}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
