import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'

/**
 * Qualquer usuário autenticado e não-bloqueado (RES-14) pode reservar — não
 * restringe por role, então a própria admin também reserva pra testar o
 * fluxo sem precisar de uma segunda conta.
 */
export async function requireCliente() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const user = session?.user as { id: string; banned?: boolean | null } | undefined
  if (!user) throw new Error('UNAUTHORIZED')
  if (user.banned) throw new Error('BLOQUEADO')
  return user
}

/**
 * Igual a requireCliente(), mas retorna null em vez de lançar quando não há
 * sessão — usado por criarReserva pra permitir reserva de convidado (sem
 * cadastro). BLOQUEADO continua sendo lançado: cliente banido não reserva
 * nem como convidado nem logado.
 */
export async function getClienteOpcional() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const user = session?.user as { id: string; banned?: boolean | null } | undefined
  if (!user) return null
  if (user.banned) throw new Error('BLOQUEADO')
  return user
}
