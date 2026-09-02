import Link from 'next/link'
import { Star, Users, Clock, Search, Ban, MessageCircle } from 'lucide-react'
import { listarClientesAdmin } from '@/lib/clientes/queries'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  PageHeader,
  RowCard,
  ColHead,
  StatTile,
  Chip,
  EmptyState,
} from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const DIAS_SUMIDO = 60

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function desdeUltimaCompra(data: Date | null): { texto: string; dias: number | null } {
  if (!data) return { texto: 'nunca comprou', dias: null }
  const dias = Math.floor((Date.now() - data.getTime()) / 86_400_000)
  if (dias === 0) return { texto: 'hoje', dias }
  if (dias === 1) return { texto: 'ontem', dias }
  return { texto: `há ${dias} dias`, dias }
}

/**
 * Lista/busca de clientes — bônus de pontos e VIP (gestão em /admin/clientes/[id]).
 * O saldo de pontos sozinho não diz se vale puxar conversa: por isso a linha
 * carrega também quanto a pessoa já gastou e há quanto tempo ela sumiu.
 */
export default async function ClientesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const clientes = await listarClientesAdmin(q)

  const vips = clientes.filter((c) => c.isVip).length
  const pontosEmCirculacao = clientes.reduce((s, c) => s + c.saldoPontos, 0)
  const sumidos = clientes.filter((c) => {
    const { dias } = desdeUltimaCompra(c.ultimaCompra)
    return dias !== null && dias >= DIAS_SUMIDO
  }).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={
          clientes.length === 0
            ? 'Nenhum cliente nessa busca'
            : `${clientes.length} cadastrado${clientes.length === 1 ? '' : 's'}${vips > 0 ? ` · ${vips} VIP${vips === 1 ? '' : 's'}` : ''} · ${pontosEmCirculacao} pontos em circulação`
        }
      >
        <form method="get" className="flex gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-caramelo"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Nome ou email"
              aria-label="Busca por nome ou email"
              className="h-11 w-56 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-11">
            Buscar
          </Button>
        </form>
      </PageHeader>

      {clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? 'Nenhum cliente com essa busca' : 'Nenhum cliente cadastrado'}
          description={
            q
              ? 'Tente parte do nome ou do email — a busca não diferencia maiúscula de minúscula.'
              : 'Quem reservar pela vitrine com conta aparece aqui, com saldo de pontos e histórico.'
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Cadastrados"
              value={clientes.length}
              sub={vips > 0 ? `${vips} marcado${vips === 1 ? '' : 's'} como VIP` : 'nenhum VIP ainda'}
              icon={Users}
            />
            <StatTile
              label="Pontos em circulação"
              value={pontosEmCirculacao}
              sub="saldo somado de todo mundo"
              icon={Star}
            />
            <StatTile
              label={`Sumidos há ${DIAS_SUMIDO}+ dias`}
              value={sumidos}
              tone={sumidos > 0 ? 'danger' : 'default'}
              sub={sumidos === 0 ? 'ninguém sumiu' : 'compraram antes e pararam'}
              icon={Clock}
            />
          </div>

          <div className="space-y-2.5">
            <ColHead
              cols={[
                { label: 'Cliente', className: 'w-[320px]' },
                { label: 'Histórico', className: 'w-[150px]' },
                { label: 'Última compra', className: 'w-[150px]' },
                { label: 'Fidelidade', className: 'flex-1' },
              ]}
            />

            <ul className="space-y-2.5">
              {clientes.map((c) => {
                const ultima = desdeUltimaCompra(c.ultimaCompra)
                const sumido = ultima.dias !== null && ultima.dias >= DIAS_SUMIDO
                return (
                  <li key={c.id}>
                    <RowCard>
                      <div className="flex min-w-0 items-center gap-3.5 md:w-[320px]">
                        <span
                          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${c.isVip ? 'bg-primary' : 'bg-muted'}`}
                        >
                          {iniciais(c.name)}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/clientes/${c.id}`}
                              className="text-[15px] font-semibold underline-offset-2 hover:underline"
                            >
                              {c.name}
                            </Link>
                            {c.isVip && (
                              <Chip tone="forte" icon={Star}>
                                VIP
                              </Chip>
                            )}
                            {c.banned && (
                              <Chip tone="creme" icon={Ban}>
                                Bloqueado
                              </Chip>
                            )}
                          </p>
                          <p className="truncate text-[13px] text-muted-foreground">
                            {c.email}
                            {c.telefone ? ` · ${c.telefone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="w-[150px] shrink-0">
                        <p className="text-sm tabular-nums">
                          {c.totalReservas} reserva{c.totalReservas === 1 ? '' : 's'}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {currency.format(c.valorTotal)} no total
                        </p>
                      </div>

                      <div className="w-[150px] shrink-0">
                        <p className={`text-sm tabular-nums ${sumido ? 'text-warn' : ''}`}>
                          {ultima.texto}
                        </p>
                        <p className="text-xs text-muted-foreground md:hidden">última compra</p>
                      </div>

                      <div className="flex min-w-[180px] flex-1 items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-1.5">
                          <Star className="size-4 text-caramelo" aria-hidden />
                          <span className="text-[15px] font-semibold tabular-nums">{c.saldoPontos}</span>
                          <span className="text-xs text-muted-foreground">pontos</span>
                        </span>
                        {sumido && (
                          <Chip tone="warn" icon={Clock}>
                            Sumido
                          </Chip>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {c.telefone && (
                          <Button asChild variant="outline" className="h-10 gap-2">
                            <a
                              href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="size-4" aria-hidden />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                        <Button asChild className="h-10">
                          <Link href={`/admin/clientes/${c.id}`}>Abrir ficha</Link>
                        </Button>
                      </div>
                    </RowCard>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
