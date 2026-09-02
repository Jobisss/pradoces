'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  House,
  ClipboardList,
  Inbox,
  Gift,
  Users,
  Ticket,
  ShoppingBasket,
  BookOpen,
  CakeSlice,
  Layers,
  Boxes,
  ChartColumn,
  History,
  SlidersHorizontal,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number }

/**
 * Os 15 destinos em lista corrida não davam pra varrer: agrupados pelo MOMENTO
 * em que a mãe usa cada um (o dia a dia primeiro, o financeiro por último),
 * viram 4 blocos de 2 a 5 itens.
 */
const GRUPOS: Array<{ titulo: string; itens: NavItem[] }> = [
  {
    titulo: 'Dia a dia',
    itens: [
      { href: '/admin', label: 'Início', icon: House },
      { href: '/admin/painel-do-dia', label: 'Painel do dia', icon: ClipboardList },
      { href: '/admin/reservas', label: 'Reservas', icon: Inbox },
      { href: '/admin/resgates', label: 'Resgates', icon: Gift },
    ],
  },
  {
    titulo: 'Cozinha',
    itens: [
      { href: '/admin/ingredientes', label: 'Ingredientes', icon: ShoppingBasket },
      { href: '/admin/receitas', label: 'Receitas', icon: BookOpen },
      { href: '/admin/produtos', label: 'Produtos', icon: CakeSlice },
      { href: '/admin/lotes', label: 'Lotes', icon: Layers },
      { href: '/admin/estoque', label: 'Estoque', icon: Boxes },
    ],
  },
  {
    titulo: 'Clientela',
    itens: [
      { href: '/admin/clientes', label: 'Clientes', icon: Users },
      { href: '/admin/sorteios', label: 'Sorteios', icon: Ticket },
    ],
  },
  {
    titulo: 'Negócio',
    itens: [
      { href: '/admin/relatorios', label: 'Relatórios', icon: ChartColumn },
      { href: '/admin/auditoria', label: 'Auditoria', icon: History },
      { href: '/admin/ajustes', label: 'Ajustes', icon: SlidersHorizontal },
      { href: '/admin/ajuda', label: 'Ajuda', icon: CircleHelp },
    ],
  },
]

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

function NavList({
  pathname,
  reservasPendentes,
  onNavigate,
}: {
  pathname: string
  reservasPendentes: number
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-[18px]">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-caramelo">
            {grupo.titulo}
          </span>
          {grupo.itens.map((item) => {
            const on = isActive(pathname, item.href)
            const badge = item.href === '/admin/reservas' ? reservasPendentes : 0
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors md:h-9 ${
                  on
                    ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                    : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon
                  className={`size-[18px] shrink-0 ${on ? 'text-foreground' : 'text-caramelo'}`}
                  aria-hidden
                />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                      on ? 'bg-card text-foreground' : 'bg-destructive text-destructive-foreground'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/**
 * Admin nav — sheet mobile (<md) + sidebar fixa desktop (≥md), per UI-SPEC
 * "Mobile-First Layout & Admin Navigation Contract". `signOut` é passada pelo
 * layout (Server Component) porque este componente precisa de `usePathname`
 * pro item ativo — não dá pra declarar a server action aqui dentro.
 * `reservasPendentes` também vem de lá: o contador no menu é o único aviso
 * que sobrevive à navegação pra dentro de outra tela.
 */
export function AdminNav({
  children,
  signOut,
  reservasPendentes = 0,
}: {
  children: React.ReactNode
  signOut: () => Promise<void>
  reservasPendentes?: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:h-16 md:px-6 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="relative size-11 md:hidden"
            aria-label={
              reservasPendentes > 0
                ? `Abrir menu (${reservasPendentes} reservas pendentes)`
                : 'Abrir menu'
            }
            onClick={() => setOpen(true)}
          >
            <Menu />
            {reservasPendentes > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" aria-hidden />
            )}
          </Button>
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo/logo-header.png"
              alt="Luizinha Confeitaria"
              width={700}
              height={306}
              priority
              className="h-9 w-auto md:h-11"
            />
            <span className="hidden rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:inline">
              painel
            </span>
          </Link>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-11 px-5 text-base">
            Sair
          </Button>
        </form>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Navegação do painel admin</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-2 pb-6">
            <NavList
              pathname={pathname}
              reservasPendentes={reservasPendentes}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar p-3 md:sticky md:top-16 md:block md:h-[calc(100svh-4rem)] md:overflow-y-auto print:hidden">
          <NavList pathname={pathname} reservasPendentes={reservasPendentes} />
        </aside>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-12 md:py-7">{children}</main>
      </div>
    </div>
  )
}
