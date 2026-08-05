'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MinusIcon, PlusIcon, XIcon } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { criarReserva } from '@/lib/actions/reservas'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function CarrinhoClient({
  logado,
  entregaAtiva,
  taxaEntrega,
}: {
  logado: boolean
  entregaAtiva: boolean
  taxaEntrega: number
}) {
  const router = useRouter()
  const { itens, remover, atualizarQtde, limpar } = useCart()
  const [deliveryMode, setDeliveryMode] = useState<'PICKUP_ONLY' | 'ENTREGA'>('PICKUP_ONLY')
  const [enderecoEntrega, setEnderecoEntrega] = useState('')
  const [janelaRetirada, setJanelaRetirada] = useState('')
  const [observacao, setObservacao] = useState('')
  const [nomeConvidado, setNomeConvidado] = useState('')
  const [telefoneConvidado, setTelefoneConvidado] = useState('')
  const [emailConvidado, setEmailConvidado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [camposErro, setCamposErro] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const subtotal = itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitario), 0)
  const total = deliveryMode === 'ENTREGA' ? subtotal + taxaEntrega : subtotal

  if (itens.length === 0) {
    return (
      <div className="space-y-2 py-8 text-center">
        <p className="text-base text-muted-foreground">Seu carrinho tá vazio.</p>
        <Link href="/" className="text-sm text-primary underline underline-offset-2">
          Ver os doces disponíveis
        </Link>
      </div>
    )
  }

  function handleReservar() {
    setErro(null)
    setCamposErro({})
    if (deliveryMode === 'ENTREGA' && !enderecoEntrega.trim()) {
      setErro('Informa o endereço pra entrega.')
      return
    }
    if (!janelaRetirada.trim()) {
      setErro(
        deliveryMode === 'ENTREGA'
          ? 'Diz pra gente quando prefere receber (ex.: "amanhã de manhã").'
          : 'Diz pra gente quando prefere retirar (ex.: "amanhã de manhã").',
      )
      return
    }
    if (!logado) {
      const novosErros: Record<string, string> = {}
      if (!nomeConvidado.trim()) novosErros.nomeConvidado = 'Esse campo é obrigatório.'
      if (!telefoneConvidado.trim()) novosErros.telefoneConvidado = 'Esse campo é obrigatório.'
      if (!emailConvidado.trim() || !emailConvidado.includes('@')) {
        novosErros.emailConvidado = 'Esse email não parece certo. Confere o `@` e o `.com`.'
      }
      if (Object.keys(novosErros).length > 0) {
        setCamposErro(novosErros)
        return
      }
    }
    startTransition(async () => {
      const res = await criarReserva({
        deliveryMode,
        enderecoEntrega: deliveryMode === 'ENTREGA' ? enderecoEntrega : undefined,
        janelaRetirada,
        observacao: observacao || undefined,
        ...(logado
          ? {}
          : { nomeConvidado, telefoneConvidado, emailConvidado }),
        itens: itens.map((i) =>
          i.tipo === 'KIT' ? { tipo: 'KIT', produtoId: i.produtoId, qtde: i.qtde } : { tipo: 'UNITARIO', loteId: i.loteId, qtde: i.qtde },
        ),
      })
      if (res.error) {
        setErro(res.error)
        if (res.fieldErrors) {
          const mapeado: Record<string, string> = {}
          for (const [campo, mensagens] of Object.entries(res.fieldErrors)) {
            if (mensagens?.[0]) mapeado[campo] = mensagens[0]
          }
          setCamposErro(mapeado)
        }
        return
      }
      limpar()
      router.push(`/r/${res.token}`)
    })
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border">
        {itens.map((item) => {
          const limite = item.tipo === 'KIT' ? item.kitDisponivel : item.qtdeDisponivelNoLote
          return (
            <li key={item.tipo === 'KIT' ? `kit:${item.produtoId}` : `lote:${item.loteId}`} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p className="text-base font-medium">
                  {item.produtoNome}
                  {item.tipo === 'KIT' && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium">Kit</span>
                  )}
                </p>
                <p className="tabular-nums text-sm text-muted-foreground">
                  {currency.format(Number(item.precoUnitario))} cada
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label="Diminuir quantidade"
                  disabled={item.qtde <= 1}
                  onClick={() => atualizarQtde(item, item.qtde - 1)}
                >
                  <MinusIcon className="size-4" />
                </Button>
                <span className="w-5 text-center tabular-nums text-sm">{item.qtde}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label="Aumentar quantidade"
                  disabled={item.qtde >= limite}
                  onClick={() => atualizarQtde(item, item.qtde + 1)}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`Remover ${item.produtoNome} do carrinho`}
                onClick={() => remover(item)}
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          )
        })}
      </ul>

      {entregaAtiva && (
        <div className="space-y-1.5">
          <Label>Como você quer receber?</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={deliveryMode === 'PICKUP_ONLY' ? 'default' : 'outline'}
              className="h-11 flex-1"
              onClick={() => setDeliveryMode('PICKUP_ONLY')}
            >
              Retirar
            </Button>
            <Button
              type="button"
              variant={deliveryMode === 'ENTREGA' ? 'default' : 'outline'}
              className="h-11 flex-1"
              onClick={() => setDeliveryMode('ENTREGA')}
            >
              Receber em casa
            </Button>
          </div>
        </div>
      )}

      {deliveryMode === 'ENTREGA' && (
        <div className="space-y-1.5">
          <Label htmlFor="enderecoEntrega">Endereço pra entrega</Label>
          <Textarea
            id="enderecoEntrega"
            value={enderecoEntrega}
            onChange={(e) => setEnderecoEntrega(e.target.value)}
            placeholder="Rua, número, bairro, ponto de referência..."
            required
          />
        </div>
      )}

      <div className="space-y-1 tabular-nums text-sm">
        {deliveryMode === 'ENTREGA' && (
          <>
            <p className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{currency.format(subtotal)}</span>
            </p>
            <p className="flex justify-between text-muted-foreground">
              <span>Entrega</span>
              <span>{currency.format(taxaEntrega)}</span>
            </p>
          </>
        )}
        <p className="flex justify-between text-lg font-medium">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="janela">{deliveryMode === 'ENTREGA' ? 'Quando prefere receber?' : 'Quando prefere retirar?'}</Label>
        <Input
          id="janela"
          value={janelaRetirada}
          onChange={(e) => setJanelaRetirada(e.target.value)}
          placeholder="Ex.: amanhã de manhã, sábado à tarde..."
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Textarea
          id="observacao"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value.slice(0, 500))}
          placeholder="Alguma preferência ou combinado com a Luizinha?"
        />
        <p className="text-right text-xs text-muted-foreground">{observacao.length}/500</p>
      </div>

      {!logado && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Reserva rápida, sem cadastro — só precisamos de como te chamar e como te avisar.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nomeConvidado">Nome</Label>
            <Input
              id="nomeConvidado"
              value={nomeConvidado}
              onChange={(e) => setNomeConvidado(e.target.value)}
              autoComplete="name"
            />
            {camposErro.nomeConvidado && <p className="text-sm text-destructive">{camposErro.nomeConvidado}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefoneConvidado">Telefone</Label>
            <Input
              id="telefoneConvidado"
              type="tel"
              value={telefoneConvidado}
              onChange={(e) => setTelefoneConvidado(e.target.value)}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
            />
            {camposErro.telefoneConvidado && (
              <p className="text-sm text-destructive">{camposErro.telefoneConvidado}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emailConvidado">Email</Label>
            <Input
              id="emailConvidado"
              type="email"
              value={emailConvidado}
              onChange={(e) => setEmailConvidado(e.target.value)}
              autoComplete="email"
            />
            {camposErro.emailConvidado && <p className="text-sm text-destructive">{camposErro.emailConvidado}</p>}
            <p className="text-xs text-muted-foreground">
              É pra onde mandamos o comprovante — e dá pra criar conta depois com esse mesmo email pra acompanhar suas
              reservas e ganhar pontos.
            </p>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <Button className="h-12 w-full text-base" disabled={pending} onClick={handleReservar}>
        {pending ? 'Reservando...' : 'Reservar'}
      </Button>

      {!logado && (
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href={`/entrar?next=${encodeURIComponent('/carrinho')}`} className="text-primary underline underline-offset-2">
            Entrar
          </Link>
        </p>
      )}
    </div>
  )
}
