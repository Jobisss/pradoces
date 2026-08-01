'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { registrarCompra, sugestoesMarca, sugestoesMercado } from '@/lib/actions/compras'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function hojeSaoPauloLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function toDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed || Number.isNaN(Number(trimmed))) return null
  try {
    return new Decimal(trimmed)
  } catch {
    return null
  }
}

type Ingrediente = { id: string; nome: string; unidadeBase: 'g' | 'ml' | 'un' }
type ItemSalvo = { id: string; resumo: string }

/**
 * Autocomplete "que aprende" (D-04) — input livre + sugestões vindas da
 * action, sem restringir a escolha ao que já existe (o valor digitado é o
 * que vale, a lista é só atalho).
 */
function SuggestInput({
  id,
  label,
  value,
  onChange,
  fetchSuggestions,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  fetchSuggestions: (prefix: string) => Promise<string[]>
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(v.trim()).then(setSuggestions)
    }, 250)
  }

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(s)
                  setOpen(false)
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Fluxo "ida ao mercado" (D-01/D-02/D-04) — a tela mais usada pela mãe.
 * Mercado+data ficam fixos no header e não limpam entre itens; cada
 * "Adicionar item" persiste NA HORA via registrarCompra (D-01) — fechar a
 * aba não perde nada, porque cada item já está no banco assim que é salvo.
 */
export function MercadoFlow({ ingredientes }: { ingredientes: Ingrediente[] }) {
  const router = useRouter()

  const [mercado, setMercado] = useState('')
  const [dataCompra, setDataCompra] = useState(hojeSaoPauloLocal)

  const [ingredienteId, setIngredienteId] = useState('')
  const [marca, setMarca] = useState('')
  const [qtdeEmbalagens, setQtdeEmbalagens] = useState('')
  const [tamanhoEmbalagem, setTamanhoEmbalagem] = useState('')
  const [precoPorEmbalagem, setPrecoPorEmbalagem] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [itensSalvos, setItensSalvos] = useState<ItemSalvo[]>([])

  const ingredienteSelecionado = ingredientes.find((i) => i.id === ingredienteId)
  const unidade = ingredienteSelecionado?.unidadeBase ?? ''

  const qtde = toDecimal(qtdeEmbalagens)
  const tamanho = toDecimal(tamanhoEmbalagem)
  const preco = toDecimal(precoPorEmbalagem)

  let preview: string | null = null
  if (qtde && tamanho && preco && unidade && !qtde.times(tamanho).isZero()) {
    const qtdeTotalBase = qtde.times(tamanho)
    const precoTotal = qtde.times(preco)
    const custoPorUnidade = precoTotal.dividedBy(qtdeTotalBase)
    preview = `= ${qtdeTotalBase.toFixed(0)}${unidade} por ${currency.format(
      precoTotal.toNumber(),
    )} → ${currency.format(custoPorUnidade.toNumber())} por ${unidade}`
  }

  function limparItem() {
    setIngredienteId('')
    setMarca('')
    setQtdeEmbalagens('')
    setTamanhoEmbalagem('')
    setPrecoPorEmbalagem('')
  }

  function adicionarItem() {
    setErro(null)
    if (!mercado.trim()) {
      setErro('Confere onde você comprou.')
      return
    }
    if (!ingredienteId) {
      setErro('Escolhe o que você comprou.')
      return
    }

    const fd = new FormData()
    fd.set('ingredienteId', ingredienteId)
    fd.set('dataCompra', dataCompra)
    fd.set('mercado', mercado)
    fd.set('marca', marca)
    fd.set('qtdeEmbalagens', qtdeEmbalagens)
    fd.set('tamanhoEmbalagem', tamanhoEmbalagem)
    fd.set('precoPorEmbalagem', precoPorEmbalagem)

    startTransition(async () => {
      const result = await registrarCompra(undefined, fd)
      if (result.error || !result.item) {
        setErro(result.error ?? 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.')
        return
      }

      toast('Anotado!')
      const nome = ingredienteSelecionado?.nome ?? ''
      const resumo = `${nome} — ${result.item.marca} · ${result.item.qtdeEmbalagens} × ${result.item.tamanhoEmbalagem}${unidade} · ${currency.format(Number(result.item.precoTotal))}`
      setItensSalvos((prev) => [{ id: result.item!.id, resumo }, ...prev])
      limparItem()
    })
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="sticky top-14 z-30 space-y-3 border-b border-border bg-background py-3 md:top-16">
        <SuggestInput
          id="mercado-header"
          label="Onde você comprou"
          value={mercado}
          onChange={setMercado}
          fetchSuggestions={sugestoesMercado}
        />
        <div className="space-y-1.5">
          <Label htmlFor="dataCompra-header">Quando</Label>
          <Input
            id="dataCompra-header"
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        {erro && (
          <p role="alert" className="text-sm text-muted-foreground">
            {erro}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ingredienteId">O que você comprou</Label>
          <Select value={ingredienteId} onValueChange={setIngredienteId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolhe um ingrediente" />
            </SelectTrigger>
            <SelectContent>
              {ingredientes.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SuggestInput id="marca" label="Marca" value={marca} onChange={setMarca} fetchSuggestions={sugestoesMarca} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="qtdeEmbalagens">Quantas embalagens</Label>
            <Input
              id="qtdeEmbalagens"
              inputMode="decimal"
              value={qtdeEmbalagens}
              onChange={(e) => setQtdeEmbalagens(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tamanhoEmbalagem">Tamanho de cada uma {unidade && `(${unidade})`}</Label>
            <Input
              id="tamanhoEmbalagem"
              inputMode="decimal"
              value={tamanhoEmbalagem}
              onChange={(e) => setTamanhoEmbalagem(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="precoPorEmbalagem">Preço de cada uma (R$)</Label>
            <Input
              id="precoPorEmbalagem"
              inputMode="decimal"
              value={precoPorEmbalagem}
              onChange={(e) => setPrecoPorEmbalagem(e.target.value)}
            />
          </div>
        </div>

        {preview && <p className="tabular-nums text-sm text-muted-foreground">{preview}</p>}

        <Button type="button" className="h-11 w-full" disabled={pending} onClick={adicionarItem}>
          {pending ? 'Adicionando...' : 'Adicionar item'}
        </Button>
      </div>

      {itensSalvos.length > 0 && (
        <ul className="divide-y divide-border">
          {itensSalvos.map((item) => (
            <li key={item.id} className="py-2 text-sm">
              {item.resumo}
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => router.push('/admin')}>
        Terminei as compras
      </Button>
    </div>
  )
}
