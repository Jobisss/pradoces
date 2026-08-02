import 'server-only'
import { prisma } from '@/lib/db/client'

/** RES-10 — comprovante público: sem login, só o token não-sequencial protege. */
export async function buscarReservaPorToken(token: string) {
  return prisma.reserva.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      janelaRetirada: true,
      observacao: true,
      criadoEm: true,
      confirmadaEm: true,
      itens: {
        select: {
          qtde: true,
          precoUnitarioCongelado: true,
          lote: { select: { validade: true, produto: { select: { nome: true } } } },
        },
      },
    },
  })
}
