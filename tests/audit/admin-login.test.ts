import { describe, it, expect, beforeEach, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ ip: '198.51.100.77' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-admin' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/email/send-verification', () => ({
  sendVerificationEmail: vi.fn(async () => ({ data: { id: 'mock' }, error: null })),
}))

import { signinAdmin, signinUser } from '@/lib/actions/auth'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { truncateAll } from '../conftest'

function form(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

async function createVerifiedAdmin(email: string, password: string) {
  await auth.api.signUpEmail({ body: { email, password, name: 'Administradora' } })
  return prisma.user.update({
    where: { email },
    data: { role: 'admin', emailVerified: true, emailVerifiedAt: new Date() },
  })
}

describe('admin_login audit (AUTH-10 / AUTH-11)', () => {
  beforeEach(async () => {
    await truncateAll()
    ctx.ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
  })

  it('writes an admin_login audit row (actorId = admin id) on a successful admin sign-in', async () => {
    const email = `admin-${Date.now()}@example.com`
    const admin = await createVerifiedAdmin(email, 'senha-admin-forte-123')

    await signinAdmin(undefined, form({ email, password: 'senha-admin-forte-123' }))

    const audit = await prisma.auditLog.findFirst({ where: { action: 'admin_login' } })
    expect(audit).not.toBeNull()
    expect(audit!.actorType).toBe('admin')
    expect(audit!.actorId).toBe(admin.id)
    // D-08: no email persisted; IP is hashed, never plaintext
    expect(audit!.ipHash).toMatch(/^[a-f0-9]{64}$/)
    const meta = JSON.stringify(audit!.metadata ?? {})
    expect(meta).not.toContain(email)
  })

  it('does NOT write admin_login when a non-admin tries the admin sign-in', async () => {
    const email = `customer-${Date.now()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'senha-cliente-123', name: 'Cliente' } })
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })

    const res = await signinAdmin(undefined, form({ email, password: 'senha-cliente-123' }))
    expect(res?.error).toBe('Email ou senha não conferem')

    const audit = await prisma.auditLog.findFirst({ where: { action: 'admin_login' } })
    expect(audit).toBeNull()
  })

  it('customer sign-in does not emit an admin_login event', async () => {
    const email = `plain-${Date.now()}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'senha-plain-123', name: 'Plain' } })
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })

    await signinUser(undefined, form({ email, password: 'senha-plain-123' }))
    const audit = await prisma.auditLog.findFirst({ where: { action: 'admin_login' } })
    expect(audit).toBeNull()
  })
})
