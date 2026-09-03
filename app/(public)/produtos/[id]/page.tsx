import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PackageXIcon, ChevronLeftIcon } from 'lucide-react'
import { buscarProdutoPublico } from '@/lib/catalogo/produtos'
import { ALERGENICOS } from '@/lib/validation/produtos'
import { WhatsappButton } from '@/components/whatsapp-button'
import { ProdutoGaleria } from '@/components/produto-galeria'
import { AdicionarCarrinho } from '@/components/adicionar-carrinho'
import { AdicionarKitCarrinho } from '@/components/adicionar-kit-carrinho'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const rotuloAlergenico = new Map<string, string>(ALERGENICOS.map((a) => [a.value, a.label]))

/**
 * CAT-02/03/05 — detalhe de produto público.
 *
 * Era uma coluna de 2xl com a foto em cima e tudo empilhado embaixo: no
 * desktop virava uma tira estreita e comprida, e o preço aparecia como
 * `text-sm` ("A partir de R$ 4,50") antes do bloco que mostra o preço de
 * verdade — dois preços diferentes na mesma tela. Agora a foto e a decisão de
 * compra ficam lado a lado, e o preço mora só no bloco de compra, onde
 * acompanha o sabor escolhido.
 */
export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const produto = await buscarProdutoPublico(id)
  if (!produto) notFound()

  const esgotado =
    (produto.tipo === 'UNITARIO' && produto.variacoes.every((v) => v.lotes.length === 0)) ||
    (produto.tipo === 'KIT' && produto.kitDisponivel === 0)

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <Link
        href="/"
        className="mb-4 inline-flex h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Voltar pra vitrine
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* Foto acompanha a rolagem no desktop — a decisão de compra é longa. */}
        <div className="lg:sticky lg:top-6">
          <ProdutoGaleria fotos={produto.fotos} nome={produto.nome} />
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {produto.categoria}
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {produto.nome}
            </h1>
            <p className="text-base leading-relaxed text-foreground">{produto.descricao}</p>
          </div>

          {esgotado ? (
            <div className="flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <PackageXIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="space-y-0.5">
                <p className="font-medium">Esgotado no momento</p>
                <p className="text-sm text-muted-foreground">
                  {produto.tipo === 'KIT'
                    ? 'Falta estoque de algum doce do kit. Volta em breve.'
                    : 'Assim que sair uma fornada nova, volta pra vitrine.'}
                  {produto.tipo === 'KIT' && produto.precoVenda && (
                    <span className="tabular-nums">
                      {' '}
                      Custava {currency.format(Number(produto.precoVenda))}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : produto.tipo === 'UNITARIO' ? (
            <AdicionarCarrinho
              produtoId={produto.id}
              produtoNome={produto.nome}
              variacoes={produto.variacoes}
            />
          ) : (
            <AdicionarKitCarrinho
              produtoId={produto.id}
              produtoNome={produto.nome}
              precoUnitario={produto.precoVenda}
              kitDisponivel={produto.kitDisponivel}
            />
          )}

          {produto.tipo === 'KIT' && produto.kitComponentes.length > 0 && (
            <div className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <p className="text-sm font-semibold">Esse kit tem</p>
              <ul className="space-y-1.5">
                {produto.kitComponentes.map((c, i) => (
                  <li key={i} className="flex items-baseline gap-2.5 text-sm tabular-nums">
                    <span className="min-w-7 font-semibold">{c.qtde}×</span>
                    <span>
                      {c.nome}
                      {c.variacaoNome ? ` — ${c.variacaoNome}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {produto.alergenicos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Contém</p>
              <div className="flex flex-wrap gap-1.5">
                {produto.alergenicos.map((a) => (
                  <span
                    key={a}
                    className="inline-flex h-7 items-center rounded-full border border-border px-3 text-xs font-medium"
                  >
                    {rotuloAlergenico.get(a) ?? a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
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
      </div>
    </section>
  )
}
