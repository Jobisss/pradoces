import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Peças de layout do painel admin. Não têm estado nem interatividade — são
 * Server Components de propósito, pra que as páginas continuem `async` sem
 * arrastar client bundle.
 *
 * Todas as cores saem dos tokens de `app/globals.css` (creme/chocolate/rosa
 * do brand kit). A profundidade vem de superfície branca + `shadow-doce-baixa`
 * (sombra tingida de chocolate) em vez de borda: uma borda rosa-clara de 1px
 * sobre o creme some em vez de separar.
 */

/* -------------------------------------------------------------- cabeçalho */

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  )
}

export function SectionHeading({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold tabular-nums text-destructive-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/** Rótulo em versalete — separa blocos sem gastar peso de um `h2`. */
export function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo">
      {children}
    </span>
  )
}

/* --------------------------------------------------------------- carcaças */

export function SurfaceCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Linha de listagem: mesma superfície do card, densidade de tabela. */
export function RowCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10 shadow-doce-baixa',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Cabeçalho de colunas — só aparece no desktop, onde as larguras batem. */
export function ColHead({ cols }: { cols: Array<{ label: string; className: string }> }) {
  return (
    <div className="hidden items-center gap-5 px-5 pb-0.5 md:flex">
      {cols.map((c) => (
        <span
          key={c.label}
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo',
            c.className
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- números */

export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
  icon: Icon,
  children,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'default' | 'ok' | 'danger'
  icon?: LucideIcon
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-card px-[18px] pb-[18px] pt-4 ring-1 ring-foreground/10 shadow-doce-baixa">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {Icon && <Icon className="size-3.5 text-caramelo" aria-hidden />}
        {label}
      </div>
      <div
        className={cn(
          'text-[28px] font-semibold leading-[1.1] tracking-tight tabular-nums',
          tone === 'ok' && 'text-success',
          tone === 'danger' && 'text-destructive'
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[13px] tabular-nums text-muted-foreground">{sub}</div>}
      {children && <div className="pt-2">{children}</div>}
    </div>
  )
}

/**
 * Medidor de margem. O traço fixo é a MÍNIMA configurada do produto — sem ele
 * a barra não diz nada, porque "62%" só é bom ou ruim contra o mínimo dela.
 */
export function Meter({
  value,
  min,
  tone = 'default',
  className,
}: {
  value: number
  min?: number
  tone?: 'default' | 'ok' | 'danger'
  className?: string
}) {
  const w = Math.max(2, Math.min(100, value))
  return (
    <div className={cn('relative h-2 w-full rounded-full bg-muted', className)}>
      <div
        className={cn(
          'h-2 rounded-full',
          tone === 'ok' && 'bg-success',
          tone === 'danger' && 'bg-destructive',
          tone === 'default' && 'bg-caramelo'
        )}
        style={{ width: `${w}%` }}
      />
      {min !== undefined && (
        <div
          className="absolute -top-[3px] h-3.5 w-0.5 rounded-sm bg-foreground/55"
          style={{ left: `${Math.min(99, Math.max(0, min))}%` }}
          aria-hidden
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- estados */

const CHIP_TONES = {
  neutral: 'bg-card text-muted-foreground ring-1 ring-border',
  creme: 'bg-background text-muted-foreground ring-1 ring-border',
  rosa: 'bg-muted text-foreground',
  forte: 'bg-primary text-primary-foreground',
  ok: 'bg-success/10 text-success ring-1 ring-success/20',
  danger: 'bg-destructive/[0.08] text-destructive ring-1 ring-destructive/20',
  warn: 'bg-caramelo/25 text-warn ring-1 ring-warn/20',
} as const

export type ChipTone = keyof typeof CHIP_TONES

/**
 * Etiqueta de estado. Sempre acompanha texto — estado nunca é comunicado só
 * por cor (a mãe abre o painel em luz do dia, e daltonismo é comum).
 */
export function Chip({
  children,
  tone = 'neutral',
  icon: Icon,
}: {
  children: React.ReactNode
  tone?: ChipTone
  icon?: LucideIcon
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        CHIP_TONES[tone]
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
}

/** Filtros de listagem como segmented control — links, não botões (server). */
export function SegmentedNav({
  items,
}: {
  items: Array<{ href: string; label: string; count?: number; active: boolean }>
}) {
  return (
    <nav className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-muted p-[3px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm transition-colors md:h-9',
            item.active
              ? 'bg-card font-semibold text-foreground shadow-[0_1px_2px_rgb(107_62_38_/_0.10)]'
              : 'font-medium text-muted-foreground hover:text-foreground'
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn('text-xs tabular-nums', item.active ? 'text-muted-foreground' : 'text-caramelo')}>
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}

/** Vazio nunca é só uma frase cinza: diz o que apareceria ali e oferece a saída. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <SurfaceCard>
      <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-background">
          <Icon className="size-7 text-caramelo" aria-hidden />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {children && <div className="flex flex-wrap justify-center gap-2 pt-1">{children}</div>}
      </div>
    </SurfaceCard>
  )
}
