import Link from 'next/link'
import { prisma } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const UNIDADE_LABEL: Record<string, string> = { g: 'g', ml: 'ml', un: 'un' }

export default async function IngredientesPage() {
  const ingredientes = await prisma.ingrediente.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { compras: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Ingredientes e embalagens</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/ingredientes/novo">Novo ingrediente</Link>
        </Button>
      </div>

      {ingredientes.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base font-medium">Nenhum ingrediente ainda</p>
          <p className="text-sm text-muted-foreground">
            Cadastra o primeiro — nome e unidade (g, ml ou unidade) bastam. Forminha e caixa também entram aqui, como embalagem.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {ingredientes.map((ing) => (
            <li key={ing.id} className="flex items-center justify-between gap-2 py-3">
              <div className="space-y-0.5">
                <Link
                  href={`/admin/ingredientes/${ing.id}`}
                  className="text-base font-medium underline-offset-2 hover:underline"
                >
                  {ing.nome}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {UNIDADE_LABEL[ing.unidadeBase]} · {ing._count.compras}{' '}
                  {ing._count.compras === 1 ? 'compra' : 'compras'}
                </p>
              </div>
              {ing.tipo === 'EMBALAGEM' && <Badge variant="secondary">Embalagem</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
