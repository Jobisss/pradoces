'use server'

import Decimal from 'decimal.js'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireCliente, getClienteOpcional } from '@/lib/auth/require-cliente'
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

const OBRIGATORIO = 'Esse campo é obrigatório.'
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

  let cliente: Awaited<ReturnType<typeof getClienteOpcional>>
  try {
    cliente = await getClienteOpcional()
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

  // Reserva de convidado (sem login): nome/telefone/email não são obrigatórios
  // no Zod (o schema não sabe se há sessão), então a obrigatoriedade
  // condicional é checada aqui, já com a sessão real resolvida — nunca confia
  // no client pra dizer se está logado.
  if (!cliente) {
    const fieldErrors: Record<string, string[]> = {}
    if (!parsed.data.nomeConvidado) fieldErrors.nomeConvidado = [OBRIGATORIO]
    if (!parsed.data.telefoneConvidado) fieldErrors.telefoneConvidado = [OBRIGATORIO]
    if (!parsed.data.emailConvidado) fieldErrors.emailConvidado = [OBRIGATORIO]
    if (Object.keys(fieldErrors).length > 0) {
      return { error: 'Confere os campos abaixo.', fieldErrors }
    }
  }

  const itensUnitario = parsed.data.itens.filter((i) => i.tipo === 'UNITARIO')
  const itensKit = parsed.data.itens.filter((i) => i.tipo === 'KIT')

  const loteIdsExplicitos = [...new Set(itensUnitario.map((i) => i.loteId))]
  const qtdePorLoteExplicito = new Map<string, number>()
  for (const item of itensUnitario) {
    qtdePorLoteExplicito.set(item.loteId, (qtdePorLoteExplicito.get(item.loteId) ?? 0) + item.qtde)
  }

  const kitProdutoIds = [...new Set(itensKit.map((i) => i.produtoId))]
  const qtdePorKitProduto = new Map<string, number>()
  for (const item of itensKit) {
    qtdePorKitProduto.set(item.produtoId, (qtdePorKitProduto.get(item.produtoId) ?? 0) + item.qtde)
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

      const hojeDate = new Date(`${hojeSaoPaulo()}T00:00:00Z`)

      // Kit não escolhe lote no carrinho (não tem lote próprio) — os
      // componentes dele são resolvidos AQUI, dentro da transação, pra usar
      // o mesmo soft-hold/lock dos itens avulsos.
      const kitItensPorKit = new Map<string, { componenteId: string; qtde: number }[]>()
      const componenteIds = new Set<string>()
      if (kitProdutoIds.length > 0) {
        const kitItensRows = await tx.produtoKitItem.findMany({
          where: { kitId: { in: kitProdutoIds } },
          select: { kitId: true, componenteId: true, qtde: true },
        })
        for (const row of kitItensRows) {
          if (!kitItensPorKit.has(row.kitId)) kitItensPorKit.set(row.kitId, [])
          kitItensPorKit.get(row.kitId)!.push({ componenteId: row.componenteId, qtde: row.qtde })
          componenteIds.add(row.componenteId)
        }
      }

      // Uma única query de lock, em ordem determinística por id (mesmo
      // princípio do lock original) — cobre tanto os lotes escolhidos
      // diretamente quanto TODOS os lotes vigentes dos componentes de kit
      // (não dá pra saber de qual lote o FEFO vai tirar antes de travar).
      const lotes = await tx.$queryRaw<LoteLock[]>`
        SELECT id, produto_id, qtde_disponivel, qtde_reservada, validade
        FROM lotes
        WHERE id = ANY(${loteIdsExplicitos}::uuid[])
           OR (produto_id = ANY(${[...componenteIds]}::uuid[]) AND validade >= ${hojeDate})
        ORDER BY id FOR UPDATE`

      const loteMap = new Map(lotes.map((l) => [l.id, l]))
      if (loteIdsExplicitos.some((id) => !loteMap.has(id))) throw new ReservaError(DADOS_DESATUALIZADOS)

      const lotesPorComponente = new Map<string, LoteLock[]>()
      for (const lote of lotes) {
        if (!componenteIds.has(lote.produto_id)) continue
        if (!lotesPorComponente.has(lote.produto_id)) lotesPorComponente.set(lote.produto_id, [])
        lotesPorComponente.get(lote.produto_id)!.push(lote)
      }
      for (const grupo of lotesPorComponente.values()) grupo.sort((a, b) => a.validade.getTime() - b.validade.getTime())

      const produtoIds = [...new Set(lotes.map((l) => l.produto_id)), ...kitProdutoIds]
      const produtos = await tx.produto.findMany({
        where: { id: { in: produtoIds } },
        select: { id: true, ativo: true, tipo: true, precoVenda: true },
      })
      const produtoMap = new Map(produtos.map((p) => [p.id, p]))

      // qtde total sendo tirada de cada lote (avulso + kit somados, pra não
      // dar dupla contagem se o mesmo lote for usado nos dois caminhos).
      const alocadoPorLote = new Map<string, number>()

      for (const [loteId, qtde] of qtdePorLoteExplicito) {
        const lote = loteMap.get(loteId)!
        const produto = produtoMap.get(lote.produto_id)
        if (!produto || !produto.ativo) throw new ReservaError(DADOS_DESATUALIZADOS)
        if (lote.validade < hojeDate) throw new ReservaError(DADOS_DESATUALIZADOS)
        const livreParaReserva = lote.qtde_disponivel - lote.qtde_reservada
        if (qtde > livreParaReserva) throw new ReservaError(ESTOQUE_INSUFICIENTE)
        alocadoPorLote.set(loteId, qtde)
      }

      const itensKitCriar: { loteId: string; qtde: number; precoUnitarioCongelado: string }[] = []
      for (const [kitProdutoId, qtdeKits] of qtdePorKitProduto) {
        const kitProduto = produtoMap.get(kitProdutoId)
        const kitItens = kitItensPorKit.get(kitProdutoId)
        if (!kitProduto || !kitProduto.ativo || kitProduto.tipo !== 'KIT' || !kitItens || kitItens.length === 0) {
          throw new ReservaError(DADOS_DESATUALIZADOS)
        }

        // Preço do kit rateado igualmente por unidade componente (não é o
        // preço individual de cada componente) — o cliente pagou o preço do
        // KIT, não a soma avulsa das peças. Mesma filosofia de "não é rateio
        // exato" já documentada no relatório de lucro por marca.
        const totalUnidadesPorKit = kitItens.reduce((soma, k) => soma + k.qtde, 0)
        const precoPorUnidade = new Decimal(kitProduto.precoVenda).dividedBy(totalUnidadesPorKit).toFixed(4)

        for (const { componenteId, qtde: qtdePorKit } of kitItens) {
          let restante = qtdePorKit * qtdeKits
          const lotesDisponiveis = lotesPorComponente.get(componenteId) ?? []
          for (const lote of lotesDisponiveis) {
            if (restante <= 0) break
            const jaAlocado = alocadoPorLote.get(lote.id) ?? 0
            const livre = lote.qtde_disponivel - lote.qtde_reservada - jaAlocado
            if (livre <= 0) continue
            const pega = Math.min(livre, restante)
            alocadoPorLote.set(lote.id, jaAlocado + pega)
            itensKitCriar.push({ loteId: lote.id, qtde: pega, precoUnitarioCongelado: precoPorUnidade })
            restante -= pega
          }
          if (restante > 0) throw new ReservaError(ESTOQUE_INSUFICIENTE)
        }
      }

      for (const [loteId, qtde] of alocadoPorLote) {
        await tx.lote.update({ where: { id: loteId }, data: { qtdeReservada: { increment: qtde } } })
      }

      return tx.reserva.create({
        data: {
          clienteId: cliente?.id,
          nomeConvidado: cliente ? undefined : parsed.data.nomeConvidado,
          telefoneConvidado: cliente ? undefined : parsed.data.telefoneConvidado,
          emailConvidado: cliente ? undefined : parsed.data.emailConvidado,
          deliveryMode: parsed.data.deliveryMode,
          enderecoEntrega: parsed.data.deliveryMode === 'ENTREGA' ? parsed.data.enderecoEntrega : undefined,
          taxaEntregaCongelada,
          janelaRetirada: parsed.data.janelaRetirada,
          observacao: parsed.data.observacao,
          itens: {
            create: [
              ...itensUnitario.map((item) => {
                const lote = loteMap.get(item.loteId)!
                const produto = produtoMap.get(lote.produto_id)!
                return {
                  loteId: item.loteId,
                  qtde: item.qtde,
                  precoUnitarioCongelado: produto.precoVenda,
                }
              }),
              ...itensKitCriar,
            ],
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
    actorId: cliente?.id ?? null,
    action: 'reserva_criada',
    entityType: 'reserva',
    entityId: resultado.id,
    metadata: { convidado: !cliente },
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

/**
 * Cancelamento de reserva de convidado (sem login) — o token do comprovante
 * público (/r/[token]) é a única prova de posse disponível, mesmo modelo de
 * confiança já usado pra exibir o comprovante em si. Só funciona enquanto a
 * reserva continuar sem dono: se ela já foi vinculada a uma conta (ver
 * afterEmailVerification em lib/auth/server.ts), o link antigo do comprovante
 * deixa de servir pra cancelar — a pessoa precisa entrar na conta.
 *
 * Reserva de convidado nunca é RESGATE nem tem PontosTransacao (decisão de
 * produto: pontos só contam depois da conta vinculada), então só cobre a
 * devolução de estoque — sem o branch de estorno de pontos/resgate.
 */
export async function cancelarReservaConvidado(token: string): Promise<ReservaActionState> {
  const h = await nextHeaders()
  const ip = clientIp(h)
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  let reservaId!: string
  try {
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { token },
        select: { id: true, clienteId: true, status: true, itens: { select: { loteId: true, qtde: true } } },
      })
      if (!reserva || reserva.clienteId !== null) throw new ReservaError(GENERIC_SERVER_ERROR)
      if (reserva.status !== 'PENDENTE' && reserva.status !== 'CONFIRMADA') {
        throw new ReservaError('Essa reserva não pode mais ser cancelada.')
      }

      for (const item of reserva.itens) {
        await tx.lote.update({
          where: { id: item.loteId },
          data:
            reserva.status === 'PENDENTE'
              ? { qtdeReservada: { decrement: item.qtde } }
              : { qtdeDisponivel: { increment: item.qtde } },
        })
      }

      await tx.reserva.update({ where: { id: reserva.id }, data: { status: 'CANCELADA', canceladaEm: new Date() } })
      reservaId = reserva.id
    })
  } catch (e) {
    if (e instanceof ReservaError) return { error: e.message }
    return { error: GENERIC_SERVER_ERROR }
  }

  await logAudit({
    actorType: 'customer',
    actorId: null,
    action: 'reserva_cancelada_convidado',
    entityType: 'reserva',
    entityId: reservaId,
    rawIp: ip,
  })

  revalidatePath('/admin/reservas')
  return { ok: true }
}
