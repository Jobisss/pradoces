import Link from 'next/link'
import { listarClientesAdmin } from '@/lib/clientes/queries'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/** Lista/busca de clientes — bônus de pontos e VIP (gestão em /admin/clientes/[id]). */
export default async function ClientesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const clientes = await listarClientesAdmin(q)

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Clientes</h1>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Busca por nome ou email" className="max-w-sm" />
        <Button type="submit" variant="outline" className="h-11">
          Buscar
        </Button>
      </form>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? 'Nenhum cliente encontrado com essa busca.' : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {clientes.map((c) => (
            <li key={c.id} className="py-4">
              <Link
                href={`/admin/clientes/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 underline-offset-2 hover:underline"
              >
                <div>
                  <p className="flex items-center gap-2 text-base font-medium text-foreground">
                    {c.name}
                    {c.isVip && <Badge>VIP</Badge>}
                    {c.banned && <Badge variant="secondary">Bloqueado</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.email}
                    {c.telefone ? ` · ${c.telefone}` : ''}
                  </p>
                </div>
                <p className="tabular-nums text-sm font-medium text-foreground">{c.saldoPontos} pontos</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
