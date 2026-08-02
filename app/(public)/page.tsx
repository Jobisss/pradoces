import Link from 'next/link'
import Image from 'next/image'
import { listarProdutosAtivos, listarCategoriasAtivas } from '@/lib/catalogo/produtos'
import { WhatsappButton } from '@/components/whatsapp-button'
import { campanhaAtiva } from '@/lib/campanhas/definicoes'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Vitrine pública (CAT-01/04/08) — troca o placeholder narrativo de Phase 1.
 * Mobile-first: cards em grid de 2 colunas no celular, touch target da foto
 * inteira (>44px em qualquer tela), preço sempre visível sem precisar clicar.
 *
 * SAZON-04 (CAT-01): quando há campanha vigente, um link deixa filtrar só os
 * produtos vinculados a ela — filtro é opt-in (`?campanha=1`), não força a
 * vitrine inteira a esconder o resto do catálogo.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; campanha?: string }>
}) {
  const { categoria, campanha: filtroCampanhaParam } = await searchParams
  const campanha = campanhaAtiva()
  const filtroCampanha = filtroCampanhaParam === '1' && campanha ? campanha.id : undefined
  const [produtos, categorias] = await Promise.all([
    listarProdutosAtivos(categoria, filtroCampanha),
    listarCategoriasAtivas(),
  ])

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 space-y-2">
        <p className="font-display text-3xl font-medium text-primary md:text-4xl">Luizinha Confeitaria</p>
        <p className="text-base text-muted-foreground">
          Doces caseiros pra reservar e retirar. Confirma tudo com a Luizinha pelo WhatsApp.
        </p>
        <WhatsappButton />
      </div>

      {campanha && (
        <div className="mb-4">
          <Link
            href={filtroCampanha ? '/' : '/?campanha=1'}
            className={`inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
              filtroCampanha ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
            }`}
          >
            {filtroCampanha ? 'Ver todos os doces' : `Ver só os doces de ${campanha.nome}`}
          </Link>
        </div>
      )}

      {categorias.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por categoria">
          <Link
            href="/"
            className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
              !categoria ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
            }`}
          >
            Todas
          </Link>
          {categorias.map((c) => (
            <Link
              key={c}
              href={`/?categoria=${encodeURIComponent(c)}`}
              className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
                categoria === c ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'
              }`}
            >
              {c}
            </Link>
          ))}
        </nav>
      )}

      {produtos.length === 0 ? (
        <div className="space-y-1 py-12 text-center">
          <p className="text-base font-medium">
            {filtroCampanha
              ? `Nenhum doce de ${campanha?.nome} por enquanto`
              : categoria
                ? 'Nada nessa categoria por enquanto'
                : 'Ainda não tem doces por aqui'}
          </p>
          <p className="text-sm text-muted-foreground">Volta mais tarde — a Luizinha tá sempre cozinhando.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {produtos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/produtos/${p.id}`}
                className="block overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
              >
                <div className="relative aspect-square bg-muted">
                  {p.capaPath ? (
                    <Image
                      src={`/uploads/${p.capaPath}-medio.webp`}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                  {!p.disponivel && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Esgotado
                    </span>
                  )}
                  {p.emCampanha && campanha && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {campanha.nome}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 p-2">
                  <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="tabular-nums text-sm text-muted-foreground">{currency.format(Number(p.precoVenda))}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
