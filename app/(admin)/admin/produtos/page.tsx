import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { margensCorrentesBatch } from '@/lib/custo/corrente'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function ProdutosPage() {
  const margens = await margensCorrentesBatch()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Produtos</h1>
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/produtos/novo">Novo produto</Link>
        </Button>
      </div>

      {margens.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base font-medium">Nenhum produto ainda</p>
          <p className="text-sm text-muted-foreground">
            Produto é o que vai pra vitrine: um doce (ligado a uma receita) ou um kit com vários.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {margens.map((item) => {
            const abaixoDoMinimo = item.margem !== null && item.margem.lessThan(item.minima)
            return (
              <li
                key={item.produtoId}
                className={`space-y-1 py-4 pl-3 ${abaixoDoMinimo ? 'border-l-4 border-destructive' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/produtos/${item.produtoId}/editar`}
                    className="text-base font-medium underline-offset-2 hover:underline"
                  >
                    {item.nome}
                  </Link>
                  {item.tipo === 'KIT' && <Badge variant="secondary">Kit</Badge>}
                </div>
                <p className="tabular-nums text-sm text-muted-foreground">
                  Preço {currency.format(item.precoVenda.toNumber())}
                </p>
                {item.custo === null ? (
                  <p className="text-xs text-muted-foreground">
                    custo incompleto — falta compra de ingrediente
                  </p>
                ) : abaixoDoMinimo ? (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="size-4" aria-hidden />
                    {item.margem!.toFixed(0)}% — abaixo de {item.minima.toFixed(0)}%
                  </p>
                ) : (
                  <p className="tabular-nums text-sm">{item.margem!.toFixed(0)}% de margem</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
