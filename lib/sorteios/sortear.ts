import 'server-only'
import crypto from 'node:crypto'
import { prisma } from '@/lib/db/client'

/**
 * SORT-04/05 — sorteio determinístico e auditável: dado o `seed` + a lista
 * ORDENADA de chances (snapshot), qualquer um recomputa o mesmo índice e
 * confere que o vencedor batido não foi escolhido "no olho". Pondera
 * naturalmente por número de chances (cliente com 3 chances aparece 3x na
 * lista, tem 3x a chance de cair o índice sorteado nele).
 */
export function escolherIndiceVencedor(seed: string, totalChances: number): number {
  const hash = crypto.createHash('sha256').update(seed).digest()
  return hash.readUInt32BE(0) % totalChances
}

export async function encerrarSorteiosVencidos(): Promise<{ encerrados: number }> {
  const vencidos = await prisma.sorteio.findMany({
    where: { status: 'ABERTO', prazo: { lte: new Date() } },
    select: { id: true },
  })

  let encerrados = 0
  for (const { id } of vencidos) {
    await prisma.$transaction(async (tx) => {
      // Ordem determinística (criadoEm, id de desempate) — o snapshot
      // congela a MESMA ordem que escolherIndiceVencedor vai usar.
      const chances = await tx.sorteioChance.findMany({
        where: { sorteioId: id },
        select: { id: true, clienteId: true, criadoEm: true },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      })

      const seed = crypto.randomBytes(16).toString('hex')
      const vencedorId = chances.length > 0 ? chances[escolherIndiceVencedor(seed, chances.length)].clienteId : null

      await tx.sorteio.update({
        where: { id },
        data: {
          status: 'ENCERRADO',
          randomSeed: seed,
          vencedorId,
          snapshotInscritos: chances.map((c) => ({
            chanceId: c.id,
            clienteId: c.clienteId,
            criadoEm: c.criadoEm.toISOString(),
          })),
          encerradoEm: new Date(),
        },
      })
    })
    encerrados++
  }

  return { encerrados }
}
