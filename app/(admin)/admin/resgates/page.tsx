import Link from 'next/link'
import { listarItensResgataveisAdmin } from '@/lib/resgate/queries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/** RESG-01/02/07 — catálogo de resgate, admin. */
export default async function ResgatesPage() {
  const itens = await listarItensResgataveisAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Catálogo de resgate</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/resgates/novo">Novo item</Link>
        </Button>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum item ainda — cadastra o que o cliente pode trocar por pontos.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <Link
                  href={`/admin/resgates/${item.id}/editar`}
                  className="text-base font-medium underline-offset-2 hover:underline"
                >
                  {item.produto?.nome ?? item.nomeCustom}
                </Link>
                <p className="tabular-nums text-sm text-muted-foreground">{item.custoPontos} pontos</p>
              </div>
              {!item.ativo && <Badge variant="secondary">Inativo</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
