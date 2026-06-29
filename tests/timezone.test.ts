import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser } from './conftest'

describe('Timestamptz round-trip (INFRA-10)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('preserves America/Sao_Paulo timezone on insert and read', async () => {
    // 14:00 in São Paulo on 2026-04-30 = 17:00 UTC
    const saoPauloMoment = new Date('2026-04-30T14:00:00-03:00')
    const user = await prisma.user.create({
      data: {
        email: `tz-${Date.now()}@x.com`,
        name: 'Timezone Test',
        role: 'customer',
        termsAcceptedAt: saoPauloMoment,
        termsVersion: 'v1.0-shell',
        privacyVersion: 'v1.0-shell',
        privacyAcceptedAt: saoPauloMoment,
      },
    })

    const fetched = await prisma.user.findUnique({ where: { id: user.id } })
    expect(fetched).not.toBeNull()
    // Timestamptz stores UTC; we read back as Date — same instant in time
    expect(fetched!.termsAcceptedAt!.toISOString()).toBe(saoPauloMoment.toISOString())
    // Render in pt-BR São Paulo TZ
    const rendered = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(fetched!.termsAcceptedAt!)
    expect(rendered).toContain('30/04/2026')
    expect(rendered).toContain('14:00')
  })

  it('handles DST boundary correctly (BR has no DST since 2019, but spec test)', async () => {
    // Brazil ended DST in 2019; America/Sao_Paulo is permanent UTC-3
    const winterDate = new Date('2026-07-15T12:00:00-03:00')
    const u = await createTestUser({ email: `dst-${Date.now()}@x.com` })
    await prisma.user.update({ where: { id: u.id }, data: { termsAcceptedAt: winterDate } })
    const back = await prisma.user.findUnique({ where: { id: u.id } })
    expect(back!.termsAcceptedAt!.toISOString()).toBe(winterDate.toISOString())
  })
})
