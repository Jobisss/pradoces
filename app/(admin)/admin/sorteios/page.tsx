import Link from 'next/link'
import { Ticket, Star, Clock, Trophy } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { datetimeFmtBR } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { PageHeader, RowCard, Chip, EmptyState } from '@/components/admin/ui'

/** SORT-01/02/07 — lista de sorteios, admin. */
export default async function SorteiosPage() {
  const sorteios = await prisma.sorteio.findMany({
    include: { vencedor: { select: { name: true } }, _count: { select: { chances: true } } },
    orderBy: { criadoEm: 'desc' },
  })

  const abertos = sorteios.filter((s) => s.status === 'ABERTO').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sorteios"
        subtitle={
          sorteios.length === 0
            ? 'Nenhum sorteio criado ainda'
            : `${sorteios.length} no total${abertos > 0 ? ` · ${abertos} aberto${abertos === 1 ? '' : 's'} agora` : ' · nenhum aberto agora'}`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/sorteios/novo">Novo sorteio</Link>
        </Button>
      </PageHeader>

      {sorteios.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nenhum sorteio ainda"
          description="Sorteio é uma forma de o cliente gastar pontos sem tirar doce do estoque: ele compra chances, você define o prêmio e o prazo."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/sorteios/novo">Criar o primeiro</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {sorteios.map((s) => {
            const aberto = s.status === 'ABERTO'
            return (
              <li key={s.id}>
                <RowCard>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      {aberto ? (
                        <Link
                          href={`/admin/sorteios/${s.id}/editar`}
                          className="text-[15px] font-semibold underline-offset-2 hover:underline"
                        >
                          {s.nome}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-semibold">{s.nome}</span>
                      )}
                      <Chip tone={aberto ? 'forte' : 'creme'} icon={aberto ? Clock : undefined}>
                        {aberto ? 'Aberto' : 'Encerrado'}
                      </Chip>
                    </p>
                    <p className="text-[13px] text-muted-foreground">Prêmio: {s.premio}</p>
                  </div>

                  <div className="w-[150px] shrink-0">
                    <p className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                      <Star className="size-3.5 text-caramelo" aria-hidden />
                      {s.custoPontos} pts/chance
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {s._count.chances} chance{s._count.chances === 1 ? '' : 's'} vendida
                      {s._count.chances === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="min-w-[200px] flex-1">
                    {aberto ? (
                      <p className="inline-flex items-center gap-2 text-[13px] tabular-nums text-muted-foreground">
                        <Clock className="size-3.5 text-caramelo" aria-hidden />
                        Encerra em {datetimeFmtBR.format(s.prazo)}
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-2 text-[13px]">
                        <Trophy className="size-3.5 text-caramelo" aria-hidden />
                        Vencedor: <span className="font-semibold">{s.vencedor?.name ?? '—'}</span>
                      </p>
                    )}
                  </div>

                  {aberto && (
                    <Button asChild variant="outline" className="h-10 shrink-0">
                      <Link href={`/admin/sorteios/${s.id}/editar`}>Gerenciar</Link>
                    </Button>
                  )}
                </RowCard>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
