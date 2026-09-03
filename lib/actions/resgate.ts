'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireCliente } from '@/lib/auth/require-cliente'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { saldoPontos } from '@/lib/pontos/queries'
import { precoDeResgateDaVariacao } from '@/lib/pontos/resgate'
import { precoEfetivo } from '@/lib/pricing/promocao'

/**
 * Resgate (RESG-03/04/05), cliente autenticado. Débito de pontos é
 * IMEDIATO (diferente da reserva normal, que credita só na confirmação) —
 * cria uma Reserva tipo RESGATE que a mãe ainda confirma manualmente
 * (lib/actions/reservas-admin.ts trata os dois tipos).
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'

class ResgateError extends Error {}

export type ResgateActionState = { error?: string; ok?: boolean; token?: string }

export async function resgatarItem(
  itemResgatavelId: string,
  janelaRetirada: string,
  observacao?: string,
): Promise<ResgateActionState> {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let cliente: Awaited<ReturnType<typeof requireCliente>>
  try {
    cliente = await requireCliente()
  } catch {
    return { error: GENERIC_SERVER_ERROR }
  }

  if (!janelaRetirada.trim()) return { error: 'Diz quando prefere retirar.' }

  let resultado: { id: string; token: string }
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const item = await tx.itemResgatavel.findUnique({
        where: { id: itemResgatavelId },
        select: {
          id: true,
          ativo: true,
          custoPontos: true,
          produtoId: true,
          variacaoId: true,
          variacao: {
            select: {
              precoVenda: true,
              precoPromocional: true,
              promocaoInicio: true,
              promocaoFim: true,
              promocaoVip: true,
            },
          },
        },
      })
      if (!item || !item.ativo) throw new ResgateError('Esse item não está mais disponível.')

      // Preço em pontos DERIVADO do custo corrente (PT-01): a coluna
      // custoPontos só vale pra item nomeCustom, que não tem produto do
      // catálogo pra ancorar o custo. Cobrar o número guardado deixaria o
      // resgate barato sempre que o ingrediente subisse.
      let precoEmPontos = item.custoPontos
      if (item.variacaoId) {
        const preco = await precoDeResgateDaVariacao(item.variacaoId)
        if (preco.pontos === null) {
          throw new ResgateError('Esse item está sem preço no momento — tenta de novo mais tarde.')
        }
        precoEmPontos = preco.pontos
      }

      // D-13: estoque da VARIAÇÃO prometida, não "qualquer sabor" do produto.
      //
      // ESCOLHE um lote (FEFO), não só confere que existe: o doce entregue em
      // resgate sai da prateleira igual a um vendido, então precisa de
      // ReservaItem + soft-hold como qualquer reserva. Antes isso era só um
      // findFirst de existência — o estoque nunca baixava, duas pessoas
      // podiam resgatar a mesma última unidade, e o custo do doce não
      // aparecia em relatório nenhum.
      //
      // `FOR UPDATE` + FEFO é o mesmo padrão de lib/actions/reservas.ts: em
      // READ COMMITTED o Postgres reavalia o WHERE depois de pegar o lock,
      // então um lote que encheu no meio do caminho cai fora sozinho.
      let loteEscolhidoId: string | null = null
      if (item.variacaoId) {
        const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
        const lotes = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM lotes
          WHERE variacao_id = ${item.variacaoId}::uuid
            AND validade >= ${new Date(`${hoje}T00:00:00Z`)}
            AND qtde_disponivel > qtde_reservada
          ORDER BY validade ASC, produzido_em ASC
          FOR UPDATE`
        if (lotes.length === 0) throw new ResgateError('Esse item acabou de esgotar.')
        loteEscolhidoId = lotes[0].id
      }

      const saldo = await saldoPontos(cliente.id)
      if (saldo < precoEmPontos) throw new ResgateError('Você não tem pontos suficientes pra esse resgate.')

      // "Quanto ela deixa de ganhar" trocando por pontos em vez de vender —
      // PREÇO DE VENDA (com promoção se ativa), nunca custo. Item nomeCustom
      // (sem produto do catálogo) não tem preço de venda pra referenciar.
      const valorResgateCongelado = item.variacao
        ? precoEfetivo(item.variacao, cliente.isVip ?? false).toFixed(4)
        : undefined

      const reserva = await tx.reserva.create({
        data: {
          clienteId: cliente.id,
          tipo: 'RESGATE',
          itemResgatavelId: item.id,
          valorResgateCongelado,
          janelaRetirada: janelaRetirada.trim(),
          observacao: observacao?.trim() || undefined,
          // preço 0: quem pagou foram os pontos. O custo do lote continua
          // congelado no próprio lote, então o relatório consegue reconhecer
          // a despesa sem inventar uma receita que não existiu.
          // Item nomeCustom não tem lote — segue sem ReservaItem, igual antes.
          itens: loteEscolhidoId
            ? { create: [{ loteId: loteEscolhidoId, qtde: 1, precoUnitarioCongelado: '0' }] }
            : undefined,
        },
        select: { id: true, token: true },
      })

      // Soft-hold até a mãe confirmar — a baixa de verdade em qtdeDisponivel
      // acontece na confirmação, igual reserva normal.
      if (loteEscolhidoId) {
        await tx.lote.update({ where: { id: loteEscolhidoId }, data: { qtdeReservada: { increment: 1 } } })
      }

      await tx.pontosTransacao.create({
        data: { clienteId: cliente.id, valor: -precoEmPontos, motivo: 'RESGATE', reservaId: reserva.id },
      })

      return reserva
    })
  } catch (e) {
    if (e instanceof ResgateError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  revalidatePath('/minha-conta/pontos')
  revalidatePath('/minha-conta/reservas')
  revalidatePath('/admin/reservas')
  return { ok: true, token: resultado.token }
}
