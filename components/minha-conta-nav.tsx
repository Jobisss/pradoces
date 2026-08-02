import Link from 'next/link'

const ITEMS = [
  { href: '/minha-conta/meus-dados', label: 'Meus dados' },
  { href: '/minha-conta/reservas', label: 'Minhas reservas' },
  { href: '/minha-conta/pontos', label: 'Meus pontos' },
] as const

export function MinhaContaNav({ ativo }: { ativo: (typeof ITEMS)[number]['href'] }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium ${
            ativo === item.href ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
