'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

const NAV_ITEMS = [
  { href: '/admin', label: 'Início' },
  { href: '/admin/painel-do-dia', label: 'Painel do dia' },
  { href: '/admin/reservas', label: 'Reservas' },
  { href: '/admin/resgates', label: 'Resgates' },
  { href: '/admin/sorteios', label: 'Sorteios' },
  { href: '/admin/ingredientes', label: 'Ingredientes' },
  { href: '/admin/receitas', label: 'Receitas' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/lotes', label: 'Lotes' },
  { href: '/admin/estoque', label: 'Estoque' },
  { href: '/admin/relatorios', label: 'Relatórios' },
  { href: '/admin/auditoria', label: 'Auditoria' },
  { href: '/admin/ajustes', label: 'Ajustes' },
  { href: '/admin/ajuda', label: 'Ajuda' },
] as const

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium transition-colors ${
            isActive(pathname, item.href)
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-accent'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Admin nav — sheet mobile (<md) + sidebar fixa desktop (≥md), per UI-SPEC
 * "Mobile-First Layout & Admin Navigation Contract". `signOut` é passada pelo
 * layout (Server Component) porque este componente precisa de `usePathname`
 * pro item ativo — não dá pra declarar a server action aqui dentro.
 */
export function AdminNav({
  children,
  signOut,
}: {
  children: React.ReactNode
  signOut: () => Promise<void>
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:h-16 md:px-8 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="size-11 md:hidden"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <Link href="/admin" className="font-display text-2xl leading-none font-medium text-foreground">
            Luizinha
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
          <div className="px-2">
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar p-4 md:block print:hidden">
          <NavList pathname={pathname} />
        </aside>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-12">{children}</main>
      </div>
    </div>
  )
}
