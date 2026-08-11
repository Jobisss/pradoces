import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PackageXIcon } from 'lucide-react'
import { buscarProdutoPublico } from '@/lib/catalogo/produtos'
import { ALERGENICOS } from '@/lib/validation/produtos'
import { WhatsappButton } from '@/components/whatsapp-button'
import { ProdutoGaleria } from '@/components/produto-galeria'
import { AdicionarCarrinho } from '@/components/adicionar-carrinho'
import { AdicionarKitCarrinho } from '@/components/adicionar-kit-carrinho'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const rotuloAlergenico = new Map<string, string>(ALERGENICOS.map((a) => [a.value, a.label]))

/** CAT-02/03/05 — detalhe de produto público. */
export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const produto = await buscarProdutoPublico(id)
  if (!produto) notFound()

  const esgotado =
    (produto.tipo === 'UNITARIO' && produto.variacoes.every((v) => v.lotes.length === 0)) ||
    (produto.tipo === 'KIT' && produto.kitDisponivel === 0)

  return (
    <section className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <ProdutoGaleria fotos={produto.fotos} nome={produto.nome} />

      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{produto.categoria}</p>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">{produto.nome}</h1>
          {produto.tipo === 'KIT' && (
            <p className="tabular-nums text-xl font-medium text-primary">{currency.format(Number(produto.precoVenda))}</p>
          )}
          {produto.tipo === 'UNITARIO' && produto.precoAPartir && (
            <p className="tabular-nums text-sm text-muted-foreground">
              A partir de {currency.format(Number(produto.precoVenda))}
            </p>
          )}
        </div>

        <p className="text-base text-foreground">{produto.descricao}</p>

        {produto.alergenicos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Contém</p>
            <div className="flex flex-wrap gap-1.5">
              {produto.alergenicos.map((a) => (
                <span key={a} className="rounded-full border border-border px-2.5 py-1 text-xs">
                  {rotuloAlergenico.get(a) ?? a}
                </span>
              ))}
            </div>
          </div>
        )}

        {produto.tipo === 'KIT' && produto.kitComponentes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Esse kit tem</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {produto.kitComponentes.map((c, i) => (
                <li key={i}>
                  {c.qtde}× {c.nome}
                  {c.variacaoNome ? ` (${c.variacaoNome})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Disponibilidade</p>
          {esgotado ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <PackageXIcon className="size-4 shrink-0" aria-hidden />
              Esgotado no momento — volta em breve.
            </p>
          ) : produto.tipo === 'UNITARIO' ? (
            <AdicionarCarrinho produtoId={produto.id} produtoNome={produto.nome} variacoes={produto.variacoes} />
          ) : (
            <AdicionarKitCarrinho
              produtoId={produto.id}
              produtoNome={produto.nome}
              precoUnitario={produto.precoVenda}
              kitDisponivel={produto.kitDisponivel}
            />
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <WhatsappButton
            mensagem={`Oi! Vi o "${produto.nome}" no site e queria reservar 🙂`}
            className="h-12 flex-1 text-base"
          />
          <Link
            href="/onde-retirar"
            className="flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-base font-medium"
          >
            Onde retirar
          </Link>
        </div>
      </div>
    </section>
  )
}
