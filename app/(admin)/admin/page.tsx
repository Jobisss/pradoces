import Link from 'next/link'
import {
  TriangleAlert,
  Clock,
  ShoppingCart,
  ChefHat,
  ChevronRight,
  Wallet,
  Layers,
  ChartColumn,
  Inbox,
  ClipboardList,
  Truck,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react'
import { listarPendencias, resumoDoDia, type Pendencia, type Severidade } from '@/lib/admin/home'
import { painelDoDia } from '@/lib/admin/painel-dia'
import {
  PageHeader,
  SectionHeading,
  EyebrowLabel,
  SurfaceCard,
  StatTile,
  Meter,
  Chip,
  EmptyState,
} from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const diaExtenso = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
})

const SEVERIDADES: Record<
  Severidade,
  { titulo: string; icone: LucideIcon; chapeu: string; icone_cor: string; ponto: string }
> = {
  agora: {
    titulo: 'Agora',
    icone: TriangleAlert,
    chapeu: 'bg-destructive/[0.09]',
    icone_cor: 'text-destructive',
    ponto: 'bg-destructive',
  },
  semana: {
    titulo: 'Essa semana',
    icone: Clock,
    chapeu: 'bg-caramelo/25',
    icone_cor: 'text-warn',
    ponto: 'bg-warn',
  },
  quando: {
    titulo: 'Quando der',
    icone: ShoppingCart,
    chapeu: 'bg-background',
    icone_cor: 'text-muted-foreground',
    ponto: 'bg-caramelo',
  },
}

const ORDEM_SEVERIDADE: Severidade[] = ['agora', 'semana', 'quando']

/** Atalho de uma mão — a mãe toca nisso com luva de cozinha ou no mercado. */
function AtalhoGrande({
  href,
  titulo,
  descricao,
  icone: Icone,
}: {
  href: string
  titulo: string
  descricao: string
  icone: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-doce transition-shadow hover:shadow-doce-alta"
    >
      <span className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-card/55">
        <Icone className="size-[26px]" aria-hidden />
      </span>
      <span className="flex-1 space-y-0.5">
        <span className="block text-xl font-semibold tracking-tight">{titulo}</span>
        <span className="block text-sm text-primary-foreground/80">{descricao}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary-foreground/50" aria-hidden />
    </Link>
  )
}

function PendenciaItem({ p, ultima }: { p: Pendencia; ultima: boolean }) {
  const s = SEVERIDADES[p.severidade]
  const Icone = s.icone
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-3 py-3.5 ${ultima ? '' : 'border-b border-border'}`}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${s.chapeu}`}>
        <Icone className={`size-[18px] ${s.icone_cor}`} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[15px] font-semibold tracking-tight">{p.titulo}</p>
        <p className="text-[13px] tabular-nums text-muted-foreground">{p.contexto}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {p.quando && (
          <span className="hidden text-xs tabular-nums text-caramelo sm:inline">{p.quando}</span>
        )}
        <Link
          href={p.href}
          className={`flex h-10 items-center rounded-lg px-4 text-sm transition-colors ${
            p.severidade === 'agora'
              ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/80'
              : 'border border-border bg-card font-medium text-foreground hover:bg-muted'
          }`}
        >
          {p.acao}
        </Link>
      </div>
    </li>
  )
}

/**
 * Home do painel admin (ADM-01/04) — os 2 atalhos 1-toque ficam SEMPRE acima
 * da lista "Precisa de atenção" (mãe opera com uma mão, no mercado ou com
 * luva de cozinha). Tudo computado ON-READ, sem tabela nova nem fila de
 * background — volume de dados ainda pequeno pra justificar cache.
 *
 * A lista de pendências é TRIADA por severidade: sem isso "margem caiu" e
 * "coco ralado sem compra" chegavam com o mesmo peso de "3 reservas
 * esperando", e ela tinha que ler as 6 linhas pra achar a única urgente.
 */
export default async function AdminHomePage() {
  const [pendencias, resumo, janelas] = await Promise.all([
    listarPendencias(),
    resumoDoDia(),
    painelDoDia(),
  ])

  const urgentes = pendencias.filter((p) => p.severidade === 'agora').length
  const proximas = janelas.slice(0, 3)
  const totalProximas = janelas.reduce((s, j) => s + j.reservas.length, 0)
  const naoPagas = janelas.flatMap((j) => j.reservas).filter((r) => !r.pago).length

  const grupos = ORDEM_SEVERIDADE.map((sev) => ({
    sev,
    itens: pendencias.filter((p) => p.severidade === sev),
  })).filter((g) => g.itens.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oi, Luizinha!"
        subtitle={`${diaExtenso.format(new Date())} · ${
          pendencias.length === 0
            ? 'nada pedindo atenção'
            : `${pendencias.length} pedindo atenção`
        } · ${totalProximas} retirada${totalProximas === 1 ? '' : 's'} marcada${totalProximas === 1 ? '' : 's'}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AtalhoGrande
          href="/admin/compras/nova"
          titulo="Fui ao mercado"
          descricao="Registrar as compras de hoje"
          icone={ShoppingCart}
        />
        <AtalhoGrande
          href="/admin/lotes/produzir"
          titulo="Produzi hoje"
          descricao="Registrar um lote que saiu do forno"
          icone={ChefHat}
        />
      </div>

      <section className="space-y-3">
        <EyebrowLabel>Resumo de hoje</EyebrowLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Faturou"
            value={currency.format(resumo.faturamento.toNumber())}
            sub={`${resumo.reservasDoDia} reserva${resumo.reservasDoDia === 1 ? '' : 's'} confirmada${resumo.reservasDoDia === 1 ? '' : 's'} hoje`}
            icon={Wallet}
          />
          <StatTile
            label="Custou"
            value={currency.format(resumo.custoTotal.toNumber())}
            sub="custo dos lotes que saíram"
            icon={Layers}
          />
          <StatTile
            label="Sobrou"
            value={currency.format(resumo.lucro.toNumber())}
            tone={resumo.lucro.isNegative() ? 'danger' : 'ok'}
            sub={resumo.margem ? `${resumo.margem.toFixed(0)}% de margem no dia` : 'nenhuma venda hoje ainda'}
            icon={ChartColumn}
          >
            {resumo.margem && (
              <Meter value={resumo.margem.toNumber()} tone={resumo.lucro.isNegative() ? 'danger' : 'ok'} />
            )}
          </StatTile>
          <StatTile
            label="Retiradas pendentes"
            value={resumo.retiradasPendentes}
            sub="já confirmadas, esperando o cliente"
            icon={Inbox}
          >
            {naoPagas > 0 && (
              <Chip tone="danger" icon={Wallet}>
                {naoPagas} ainda a pagar
              </Chip>
            )}
          </StatTile>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <SectionHeading title="Precisa de atenção" count={pendencias.length}>
            {urgentes > 0 && (
              <Chip tone="danger" icon={TriangleAlert}>
                {urgentes} urgente{urgentes === 1 ? '' : 's'}
              </Chip>
            )}
          </SectionHeading>

          {pendencias.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="Tudo em dia por aqui"
              description="Reserva nova, lote vencendo, ingrediente sumindo do mercado ou margem caindo — aparece aqui assim que acontecer."
            >
              <Link
                href="/admin/painel-do-dia"
                className="flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium"
              >
                Ver painel do dia
              </Link>
            </EmptyState>
          ) : (
            <SurfaceCard className="pt-1">
              {grupos.map((g) => {
                const s = SEVERIDADES[g.sev]
                return (
                  <div key={g.sev}>
                    <div className="flex items-center gap-2 pb-1 pt-4">
                      <span className={`size-[7px] rounded-full ${s.ponto}`} aria-hidden />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                        {s.titulo}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-caramelo">
                        {g.itens.length}
                      </span>
                      <span className="h-px flex-1 bg-border" aria-hidden />
                    </div>
                    <ul>
                      {g.itens.map((p, i) => (
                        <PendenciaItem key={p.id} p={p} ultima={i === g.itens.length - 1} />
                      ))}
                    </ul>
                  </div>
                )
              })}
            </SurfaceCard>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading title="Próximas retiradas">
            <Link
              href="/admin/painel-do-dia"
              className="text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver painel do dia
            </Link>
          </SectionHeading>

          {proximas.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma retirada marcada"
              description="Assim que você confirmar uma reserva, a janela combinada aparece aqui."
            />
          ) : (
            <SurfaceCard>
              <div className="space-y-4">
                {proximas.map((janela) => (
                  <div key={janela.janela} className="space-y-1">
                    <div className="flex items-center gap-2 border-b border-border pb-1.5">
                      <Clock className="size-3.5 text-caramelo" aria-hidden />
                      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        {janela.janela}
                      </span>
                      <span className="text-xs tabular-nums text-caramelo">
                        {janela.reservas.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border">
                      {janela.reservas.slice(0, 3).map((r) => (
                        <li key={r.id} className="space-y-1 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex-1 text-sm font-semibold">{r.clienteNome}</span>
                            {r.deliveryMode === 'ENTREGA' && (
                              <Chip tone="rosa" icon={Truck}>
                                Entrega
                              </Chip>
                            )}
                            <Chip tone={r.pago ? 'ok' : 'danger'}>{r.pago ? 'Pago' : 'A pagar'}</Chip>
                          </div>
                          <p className="text-[13px] tabular-nums text-muted-foreground">
                            {r.itens.map((i) => `${i.qtde}× ${i.nome}`).join(' · ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}
        </section>
      </div>
    </div>
  )
}
