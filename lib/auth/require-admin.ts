import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'

/**
 * Server Actions são endpoints POST públicos — o layout (admin) protege
 * PÁGINAS, não actions. Toda mutação da Phase 2+ chama isto na primeira linha.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const user = session?.user as { id: string; role?: string } | undefined
  if (!user || user.role !== 'admin') {
    throw new Error('UNAUTHORIZED') // a action captura e retorna erro genérico
  }
  return user
}
