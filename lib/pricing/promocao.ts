import 'server-only'
import Decimal from 'decimal.js'
import { hojeSaoPaulo } from '@/lib/lotes/queries'

/**
 * Promoção manual por Variação (sabor) — desconto que a mãe define direto no
 * produto, com janela de datas CIVIS em America/Sao_Paulo (mesmo padrão de
 * `lote.validade`/`hojeSaoPaulo()`, Pitfall 10): ela pensa em "vale até
 * domingo", não em hora exata, então `promocaoInicio`/`promocaoFim` são
 * `@db.Date` e a comparação usa início do dia, igual ao resto do catálogo.
 *
 * Único chokepoint que resolve "qual preço vale agora" — usado tanto pra
 * exibir na vitrine quanto pra congelar em `ReservaItem.precoUnitarioCongelado`
 * (lib/actions/reservas.ts). Pontos de fidelidade não precisam de lógica
 * própria: já são creditados sobre o valor congelado da reserva, então uma
 * promoção ativa reduz os pontos automaticamente, sem precisar espalhar essa
 * regra em outro lugar (decisão confirmada com a usuária).
 */
export type VariacaoComPromo = {
  precoVenda: Decimal | string
  precoPromocional: Decimal | string | null
  promocaoInicio: Date | null
  promocaoFim: Date | null
}

export function inicioDoDiaSaoPaulo(referencia: string = hojeSaoPaulo()): Date {
  return new Date(`${referencia}T00:00:00Z`)
}

export function promocaoAtiva(v: VariacaoComPromo, hoje: Date = inicioDoDiaSaoPaulo()): boolean {
  return (
    v.precoPromocional !== null &&
    v.promocaoInicio !== null &&
    v.promocaoFim !== null &&
    hoje >= v.promocaoInicio &&
    hoje <= v.promocaoFim
  )
}

/** Preço que vale agora — promocional se a janela estiver ativa, senão o normal. */
export function precoEfetivo(v: VariacaoComPromo, hoje?: Date): Decimal {
  return new Decimal(promocaoAtiva(v, hoje) ? v.precoPromocional! : v.precoVenda)
}
