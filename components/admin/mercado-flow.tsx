'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { Check, ShoppingCart, CalendarDays, TrendingUp } from 'lucide-react'
import { registrarCompra, sugestoesMarca, sugestoesMercado } from '@/lib/actions/compras'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { SuggestInput } from '@/components/admin/suggest-input'
import {
  FormLayout,
  FormSection,
  Field,
  FieldRow,
  AdminInput,
  AdminSelectTrigger,
  InputWithSuffix,
  FormAlert,
  CostCard,
} from '@/components/admin/form'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currency4 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 4,
})

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

type Ingrediente = {
  id: string
  nome: string
  unidadeBase: 'g' | 'ml' | 'un'
  tipo: 'INGREDIENTE' | 'EMBALAGEM'
}
type ItemSalvo = { id: string; nome: string; detalhe: string; total: Decimal; embalagem: boolean }

/**
 * Fluxo "ida ao mercado" (D-01/D-02/D-04) — a tela mais usada pela mãe, e a
 * única que ela abre EM PÉ, no corredor do mercado, com o celular numa mão.
 * Mercado+data ficam fixos no topo e não limpam entre itens; cada
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

  // Preview do custo por unidade base — é o número que vai congelar no lote
  // depois, então vale mostrar grande antes de anotar, não como rodapé.
  let preview: { custoUnidade: Decimal; qtdeTotal: Decimal; precoTotal: Decimal } | null = null
  if (qtde && tamanho && preco && unidade && !qtde.times(tamanho).isZero()) {
    const qtdeTotalBase = qtde.times(tamanho)
    const precoTotal = qtde.times(preco)
    preview = {
      custoUnidade: precoTotal.dividedBy(qtdeTotalBase),
      qtdeTotal: qtdeTotalBase,
      precoTotal,
    }
  }

  const totalDaIda = itensSalvos.reduce((s, i) => s.plus(i.total), new Decimal(0))
  const totalEmbalagens = itensSalvos
    .filter((i) => i.embalagem)
    .reduce((s, i) => s.plus(i.total), new Decimal(0))

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
      setItensSalvos((prev) => [
        {
          id: result.item!.id,
          nome: ingredienteSelecionado?.nome ?? '',
          detalhe: `${result.item!.marca} · ${result.item!.qtdeEmbalagens} × ${result.item!.tamanhoEmbalagem}${unidade}`,
          total: new Decimal(String(result.item!.precoTotal)),
          embalagem: ingredienteSelecionado?.tipo === 'EMBALAGEM',
        },
        ...prev,
      ])
      limparItem()
    })
  }

  const rail = (
    <CostCard
      label="Nessa ida ao mercado"
      value={currency.format(totalDaIda.toNumber())}
      sub={
        itensSalvos.length === 0
          ? 'nenhum item anotado ainda'
          : `${itensSalvos.length} ${itensSalvos.length === 1 ? 'item anotado' : 'itens anotados'}`
      }
      icon={ShoppingCart}
      rows={
        totalEmbalagens.isZero()
          ? undefined
          : [
              { label: 'Ingredientes', value: currency.format(totalDaIda.minus(totalEmbalagens).toNumber()) },
              { label: 'Embalagens', value: currency.format(totalEmbalagens.toNumber()) },
            ]
      }
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-[15px]"
        onClick={() => router.push('/admin')}
      >
        Terminei as compras
      </Button>
    </CostCard>
  )

  return (
    <FormLayout rail={rail}>
      {/*
        Mercado e data não limpam entre itens — ela preenche uma vez e depois
        só lança item atrás de item. Fica grudado no topo no celular.
      */}
      <div className="sticky top-14 z-30 md:top-16">
        <FormSection title="Onde e quando" hint="Fica fixo enquanto você lança os itens — só preenche uma vez.">
          <FieldRow>
            <Field label="Mercado" htmlFor="mercado-header">
              <SuggestInput
                id="mercado-header"
                value={mercado}
                onChange={setMercado}
                fetchSuggestions={sugestoesMercado}
                placeholder="Atacadão, Assaí, mercado do bairro..."
              />
            </Field>
            <Field label="Data da compra" htmlFor="dataCompra-header" className="sm:max-w-56">
              <AdminInput
                id="dataCompra-header"
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </Field>
          </FieldRow>
        </FormSection>
      </div>

      <FormSection title="O que você comprou">
        {erro && <FormAlert title="Falta uma coisa" detail={erro} />}

        <FieldRow>
          <Field label="Ingrediente" htmlFor="ingredienteId" className="sm:flex-[1.4]">
            <Select value={ingredienteId} onValueChange={setIngredienteId}>
              <AdminSelectTrigger id="ingredienteId">
                <SelectValue placeholder="Escolhe um ingrediente" />
              </AdminSelectTrigger>
              <SelectContent>
                {ingredientes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Marca" htmlFor="marca">
            <SuggestInput
              id="marca"
              value={marca}
              onChange={setMarca}
              fetchSuggestions={sugestoesMarca}
              placeholder="Moça, Italac..."
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Quantas embalagens" htmlFor="qtdeEmbalagens">
            <InputWithSuffix
              id="qtdeEmbalagens"
              inputMode="decimal"
              value={qtdeEmbalagens}
              onChange={(e) => setQtdeEmbalagens(e.target.value)}
              suffix="un"
            />
          </Field>
          <Field label="Tamanho de cada uma" htmlFor="tamanhoEmbalagem">
            <InputWithSuffix
              id="tamanhoEmbalagem"
              inputMode="decimal"
              value={tamanhoEmbalagem}
              onChange={(e) => setTamanhoEmbalagem(e.target.value)}
              suffix={unidade || '—'}
            />
          </Field>
          <Field label="Preço de cada uma (R$)" htmlFor="precoPorEmbalagem">
            <AdminInput
              id="precoPorEmbalagem"
              inputMode="decimal"
              value={precoPorEmbalagem}
              onChange={(e) => setPrecoPorEmbalagem(e.target.value)}
            />
          </Field>
        </FieldRow>

        {preview && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-background px-[18px] py-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Fica valendo
              </p>
              <p className="text-xl font-semibold tracking-tight tabular-nums">
                {currency4.format(preview.custoUnidade.toNumber())} por {unidade}
              </p>
            </div>
            <p className="text-[15px] font-medium tabular-nums sm:text-right">
              {preview.qtdeTotal.toFixed(0)}
              {unidade} por {currency.format(preview.precoTotal.toNumber())}
            </p>
          </div>
        )}

        <Button
          type="button"
          className="h-12 w-full gap-2 text-base"
          disabled={pending}
          onClick={adicionarItem}
        >
          <Check className="size-[18px]" aria-hidden />
          {pending ? 'Anotando...' : 'Anotar esse item'}
        </Button>
      </FormSection>

      {itensSalvos.length > 0 && (
        <FormSection title="Já anotados hoje" hint="Cada um destes já está salvo no banco.">
          <ul className="divide-y divide-border">
            {itensSalvos.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <Check className="size-4 text-success" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="text-sm font-semibold">{item.nome}</span>
                <span className="flex-1 text-[13px] text-muted-foreground">{item.detalhe}</span>
                <span className="text-[15px] font-semibold tabular-nums">
                  {currency.format(item.total.toNumber())}
                </span>
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      {itensSalvos.length === 0 && (
        <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
          <TrendingUp className="size-4 text-caramelo" aria-hidden />
          Cada item some do formulário assim que é anotado — e já entra no custo das receitas.
        </p>
      )}

      <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
        <CalendarDays className="size-4 text-caramelo" aria-hidden />
        Anotando com a data certa, o histórico de preço por marca fica comparável no relatório.
      </p>
    </FormLayout>
  )
}
