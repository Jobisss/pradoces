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
