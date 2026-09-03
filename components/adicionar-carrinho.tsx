'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MinusIcon, PlusIcon, CheckIcon, PackageXIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { Button } from '@/components/ui/button'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type LoteOpcao = { id: string; qtdeDisponivel: number; diasParaVencer: number }
type VariacaoOpcao = {
  id: string
  nome: string
  precoVenda: string
  precoOriginal: string | null
  emPromocao: boolean
  lotes: LoteOpcao[]
}

function rotuloValidade(dias: number): string {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

/**
 * RES-01/D-13 — escolhe a variação (sabor), depois o lote (default: o que
 * vence primeiro) e a quantidade, junta no carrinho.
 *
 * Três coisas que estavam erradas e mudaram aqui:
 *
 * 1. O `<select>` listava TODA variação ativa, inclusive as sem lote. A
 *    cliente escolhia "Morango" pra receber "essa variação esgotou". Agora só
 *    sabor com estoque é escolhível, e os esgotados viram uma nota discreta —
 *    some da escolha, mas continua sendo informação ("tinha morango").
 * 2. O estado começava em `variacoes[0]`. Se o primeiro sabor tivesse
 *    acabado, a página abria esgotada mesmo com os outros à venda.
 * 3. Quantidade e "ver carrinho" montavam condicionalmente e EMPURRAVAM a
 *    página pra baixo a cada clique. Agora o bloco tem altura estável: a
 *    quantidade está sempre lá (desabilitada quando não dá pra comprar) e o
 *    espaço do "ver carrinho" fica reservado.
 */
export function AdicionarCarrinho({
  produtoId,
  produtoNome,
  variacoes,
}: {
  produtoId: string
  produtoNome: string
  variacoes: VariacaoOpcao[]
}) {
  const router = useRouter()
  const { adicionar } = useCart()

  const disponiveis = variacoes.filter((v) => v.lotes.length > 0)
  const esgotadas = variacoes.filter((v) => v.lotes.length === 0)

  const [variacaoId, setVariacaoId] = useState(disponiveis[0]?.id ?? '')
  const [loteId, setLoteId] = useState(disponiveis[0]?.lotes[0]?.id ?? '')
  const [qtde, setQtde] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  const variacao = disponiveis.find((v) => v.id === variacaoId) ?? disponiveis[0]
  const lote = variacao?.lotes.find((l) => l.id === loteId) ?? variacao?.lotes[0]
  const podeComprar = !!variacao && !!lote

  function handleTrocarVariacao(id: string) {
    setVariacaoId(id)
    const nova = disponiveis.find((v) => v.id === id)
    setLoteId(nova?.lotes[0]?.id ?? '')
    setQtde(1)
  }

  function handleAdicionar() {
    if (!variacao || !lote) return
    adicionar(
      {
        tipo: 'UNITARIO',
        loteId: lote.id,
        produtoId,
        produtoNome: variacoes.length > 1 ? `${produtoNome} — ${variacao.nome}` : produtoNome,
        precoUnitario: variacao.precoVenda,
        validade: '',
        qtdeDisponivelNoLote: lote.qtdeDisponivel,
      },
      qtde,
    )
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  if (disponiveis.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <PackageXIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-0.5">
          <p className="font-medium">Esgotado no momento</p>
          <p className="text-sm text-muted-foreground">
            Assim que sair uma fornada nova, volta pra vitrine. Chama no WhatsApp que a gente avisa.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {currency.format(Number(variacao!.precoVenda))}
        </p>
        {variacao!.emPromocao && variacao!.precoOriginal && (
          <>
            <p className="text-base tabular-nums text-muted-foreground line-through">
              {currency.format(Number(variacao!.precoOriginal))}
            </p>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              Promoção
            </span>
          </>
        )}
      </div>

      {/* Sabor como pílula, não select: com 2 a 6 sabores as opções cabem na
          tela, e escolher deixa de ser "abrir uma lista e procurar". */}
      {disponiveis.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Qual sabor?</p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map((v) => {
              const ativa = v.id === variacao!.id
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => handleTrocarVariacao(v.id)}
                  className={`flex h-11 items-center rounded-full px-4 text-sm transition-colors ${
                    ativa
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'border border-border font-medium hover:bg-muted'
                  }`}
                >
                  {v.nome}
                </button>
              )
            })}
          </div>
          {esgotadas.length > 0 && (
            <p className="text-[13px] text-muted-foreground">
              {esgotadas.map((v) => v.nome).join(', ')}{' '}
              {esgotadas.length === 1 ? 'esgotou' : 'esgotaram'} por enquanto.
            </p>
          )}
        </div>
      )}

      {variacao!.lotes.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="lote-select" className="text-sm font-medium">
            Qual fornada?
          </label>
          <select
            id="lote-select"
            value={lote!.id}
            onChange={(e) => {
              setLoteId(e.target.value)
              setQtde(1)
            }}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {variacao!.lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {rotuloValidade(l.diasParaVencer)} · {l.qtdeDisponivel} disponíveis
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="space-y-0.5">
          <span className="block text-sm font-medium">Quantidade</span>
          {podeComprar && (
            <span className="block text-[13px] tabular-nums text-muted-foreground">
              {lote!.qtdeDisponivel} {lote!.qtdeDisponivel === 1 ? 'disponível' : 'disponíveis'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Diminuir quantidade"
            disabled={!podeComprar || qtde <= 1}
            onClick={() => setQtde((q) => Math.max(1, q - 1))}
          >
            <MinusIcon className="size-4" />
          </Button>
          <span className="w-6 text-center text-base tabular-nums">{qtde}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Aumentar quantidade"
            disabled={!podeComprar || qtde >= lote!.qtdeDisponivel}
            onClick={() => setQtde((q) => Math.min(lote!.qtdeDisponivel, q + 1))}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        className="h-12 w-full gap-2 text-base"
        disabled={!podeComprar}
        onClick={handleAdicionar}
      >
        {adicionado && <CheckIcon className="size-[18px]" aria-hidden />}
        {adicionado ? 'Adicionado!' : 'Adicionar ao carrinho'}
      </Button>

      {/* Altura reservada: sem isso o link aparecendo empurrava tudo. */}
      <div className="flex h-6 items-center justify-center">
        {adicionado && (
          <button
            type="button"
            onClick={() => router.push('/carrinho')}
            className="text-sm font-medium underline underline-offset-2"
          >
            Ver carrinho
          </button>
        )}
      </div>
    </div>
  )
}
