'use server'

import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireCliente } from '@/lib/auth/require-cliente'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { hojeSaoPaulo } from '@/lib/lotes/queries'
import { ReservaSchema } from '@/lib/validation/reservas'

/**
 * Criação de reserva (RES-01..05/11/12/15), cliente autenticado. Soft hold
 * via SELECT FOR UPDATE dentro de uma transação — qtde_reservada é
 * incrementada aqui, mas qtde_disponivel só desconta na confirmação da mãe
 * (lib/actions/reservas-admin.ts). CHECK no schema
 * (lotes_reservada_nao_excede_disponivel) é a defesa de segundo nível caso
 * algum bug de app pule essa checagem.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const DADOS_DESATUALIZADOS = 'Os dados mudaram — recarrega a página e confere o carrinho de novo.'
const ESTOQUE_INSUFICIENTE = 'Um dos itens não tem mais essa quantidade disponível. Ajusta o carrinho e tenta de novo.'
const ENTREGA_INDISPONIVEL = 'Entrega não está disponível no momento — escolhe retirada.'

class ReservaError extends Error {}

export type ReservaActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  ok?: boolean
  id?: string
  token?: string
}

type LoteLock = {
  id: string
  produto_id: string
  qtde_disponivel: number
  qtde_reservada: number
  validade: Date
}

export async function criarReserva(input: unknown): Promise<ReservaActionState> {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let cliente: Awaited<ReturnType<typeof requireCliente>>
  try {
    cliente = await requireCliente()
  } catch (e) {
    if (e instanceof Error && e.message === 'BLOQUEADO') {
      return { error: 'Sua conta não pode fazer reservas no momento. Fala com a Luizinha pelo WhatsApp.' }
    }
    return { error: GENERIC_SERVER_ERROR }
  }

  const parsed = ReservaSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const loteIds = [...new Set(parsed.data.itens.map((i) => i.loteId))]
  const qtdePorLote = new Map<string, number>()
  for (const item of parsed.data.itens) {
    qtdePorLote.set(item.loteId, (qtdePorLote.get(item.loteId) ?? 0) + item.qtde)
  }

  let resultado: { id: string; token: string }
  try {
    resultado = await prisma.$transaction(async (tx) => {
      let taxaEntregaCongelada: string | undefined
      if (parsed.data.deliveryMode === 'ENTREGA') {
        const config = await tx.configuracao.findUnique({ where: { id: 1 } })
        if (!config?.entregaAtiva) throw new ReservaError(ENTREGA_INDISPONIVEL)
        taxaEntregaCongelada = config.taxaEntregaPadrao.toFixed(4)
      }

      // ORDER BY id: ordem determinística de lock entre lotes diferentes,
      // pra duas reservas concorrentes com itens sobrepostos não deadlockarem.
      const lotes = await tx.$queryRaw<LoteLock[]>`
        SELECT id, produto_id, qtde_disponivel, qtde_reservada, validade
        FROM lotes WHERE id = ANY(${loteIds}::uuid[]) ORDER BY id FOR UPDATE`

      if (lotes.length !== loteIds.length) throw new ReservaError(DADOS_DESATUALIZADOS)
      const loteMap = new Map(lotes.map((l) => [l.id, l]))

      const produtoIds = [...new Set(lotes.map((l) => l.produto_id))]
      const produtos = await tx.produto.findMany({
        where: { id: { in: produtoIds } },
        select: { id: true, ativo: true, precoVenda: true },
      })
      const produtoMap = new Map(produtos.map((p) => [p.id, p]))

      const hojeDate = new Date(`${hojeSaoPaulo()}T00:00:00Z`)
      for (const [loteId, qtde] of qtdePorLote) {
        const lote = loteMap.get(loteId)
        if (!lote) throw new ReservaError(DADOS_DESATUALIZADOS)
        const produto = produtoMap.get(lote.produto_id)
        if (!produto || !produto.ativo) throw new ReservaError(DADOS_DESATUALIZADOS)
        if (lote.validade < hojeDate) throw new ReservaError(DADOS_DESATUALIZADOS)
        const livreParaReserva = lote.qtde_disponivel - lote.qtde_reservada
        if (qtde > livreParaReserva) throw new ReservaError(ESTOQUE_INSUFICIENTE)
      }

      for (const [loteId, qtde] of qtdePorLote) {
        await tx.lote.update({ where: { id: loteId }, data: { qtdeReservada: { increment: qtde } } })
      }

      return tx.reserva.create({
        data: {
          clienteId: cliente.id,
          deliveryMode: parsed.data.deliveryMode,
          enderecoEntrega: parsed.data.deliveryMode === 'ENTREGA' ? parsed.data.enderecoEntrega : undefined,
          taxaEntregaCongelada,
          janelaRetirada: parsed.data.janelaRetirada,
          observacao: parsed.data.observacao,
          itens: {
            create: parsed.data.itens.map((item) => {
              const lote = loteMap.get(item.loteId)!
              const produto = produtoMap.get(lote.produto_id)!
              return {
                loteId: item.loteId,
                qtde: item.qtde,
                precoUnitarioCongelado: produto.precoVenda,
              }
            }),
          },
        },
        select: { id: true, token: true },
      })
    })
  } catch (e) {
    if (e instanceof ReservaError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'customer',
    actorId: cliente.id,
    action: 'reserva_criada',
    entityType: 'reserva',
    entityId: resultado.id,
    rawIp: ip,
  })

  // RES-05/15: email pro cliente (comprovante) + pra mãe, e alerta no painel
  // admin — enfileirados APÓS o commit (nunca dentro da transação), via
  // pg-boss. Envio real depende do Resend configurado (ver tarefa de
  // notificações); por ora o painel admin já mostra a fila de pendentes
  // sozinho, sem depender do email.

  revalidatePath('/minha-conta/reservas')
  revalidatePath('/admin/reservas')
  return { ok: true, id: resultado.id, token: resultado.token }
}

/**
 * RES-08/09 — cancelamento do próprio cliente, sem dialog de confirmação (a
 * UI dá 30s de UNDO antes de chamar isto — ver components/cancelar-reserva-
 * botao.tsx). Cobre PENDENTE (só libera o soft hold) e CONFIRMADA (devolve
 * estoque + estorna os pontos daquela reserva com um débito compensatório —
 * nunca edita/deleta o crédito original, o ledger é imutável).
 *
 * Nota: RES-08 fala em "até X horas antes da retirada" (janelaCancelamentoHoras
 * em Configuracao), mas `janelaRetirada` é texto livre (ex.: "amanhã de
 * manhã") — não existe um horário estruturado pra comparar. Por ora o
 * cancelamento é permitido em qualquer momento antes de AGUARDANDO_RETIRADA;
 * a janela configurável fica pra quando existir um horário de retirada real.
 */
export async function cancelarReserva(reservaId: string): Promise<ReservaActionState> {
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

  try {
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: reservaId },
        select: { id: true, clienteId: true, status: true, tipo: true, itens: { select: { loteId: true, qtde: true } } },
      })
      if (!reserva || reserva.clienteId !== cliente.id) throw new ReservaError(GENERIC_SERVER_ERROR)
      if (reserva.status !== 'PENDENTE' && reserva.status !== 'CONFIRMADA') {
        throw new ReservaError('Essa reserva não pode mais ser cancelada.')
      }

      if (reserva.tipo === 'RESGATE') {
        // Devolve os pontos do resgate (débito imediato na hora de trocar,
        // RESG-04) — mesmo padrão de rejeitarReserva no admin.
        const debito = await tx.pontosTransacao.findFirst({ where: { reservaId: reserva.id, motivo: 'RESGATE' } })
        if (debito) {
          await tx.pontosTransacao.create({
            data: { clienteId: cliente.id, valor: -debito.valor, motivo: 'RESGATE_REJEITADO', reservaId: reserva.id },
          })
        }
      } else {
        for (const item of reserva.itens) {
          await tx.lote.update({
            where: { id: item.loteId },
            data:
              reserva.status === 'PENDENTE'
                ? { qtdeReservada: { decrement: item.qtde } }
                : { qtdeDisponivel: { increment: item.qtde } },
          })
        }

        if (reserva.status === 'CONFIRMADA') {
          const creditos = await tx.pontosTransacao.findMany({
            where: { reservaId: reserva.id, motivo: 'RESERVA_CONFIRMADA' },
          })
          for (const credito of creditos) {
            await tx.pontosTransacao.create({
              data: { clienteId: cliente.id, valor: -credito.valor, motivo: 'CANCELAMENTO', reservaId: reserva.id },
            })
          }
        }
      }

      await tx.reserva.update({ where: { id: reservaId }, data: { status: 'CANCELADA', canceladaEm: new Date() } })
    })
  } catch (e) {
    if (e instanceof ReservaError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'customer',
    actorId: cliente.id,
    action: 'reserva_cancelada',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
  })

  revalidatePath('/minha-conta/reservas')
  revalidatePath('/minha-conta/pontos')
  revalidatePath('/admin/reservas')
  return { ok: true }
}
