import { describe, it, expect } from 'vitest'
import { Writable } from 'node:stream'
import { createLogger, redactPaths } from '@/lib/log'

/**
 * Capture the real logger's serialized output synchronously by giving it an
 * in-memory destination stream. This exercises the canonical redact config
 * (same `redactPaths` used by the exported `logger` singleton) without relying
 * on pino's worker-thread transport, which writes asynchronously to a raw fd.
 */
function capture() {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString())
      cb()
    },
  })
  const log = createLogger(stream)
  return { log, output: () => chunks.join('') }
}

describe('pino redact (INFRA-07, T-PII-01)', () => {
  it('redacts top-level PII fields', () => {
    const { log, output } = capture()
    log.info(
      {
        email: 'mae@luizinhaconfeitaria.com.br',
        password: 'secret123',
        telefone: '11999999999',
        cpf: '12345678900',
        token: 'abc.def.ghi',
        ip: '203.0.113.5',
      },
      'test',
    )
    const out = output()
    expect(out).not.toContain('mae@luizinhaconfeitaria.com.br')
    expect(out).not.toContain('secret123')
    expect(out).not.toContain('11999999999')
    expect(out).not.toContain('12345678900')
    expect(out).not.toContain('abc.def.ghi')
    expect(out).not.toContain('203.0.113.5')
    expect(out).toContain('[redacted]')
  })

  it('redacts nested *.email path', () => {
    const { log, output } = capture()
    log.info({ user: { email: 'cliente@x.com', name: 'Maria' } }, 'nested')
    const out = output()
    expect(out).not.toContain('cliente@x.com')
    expect(out).not.toContain('Maria')
  })

  it('redacts authorization, cookie, set-cookie, svix-signature', () => {
    const { log, output } = capture()
    log.info(
      {
        authorization: 'Bearer xyz',
        cookie: 'session=abc',
        'set-cookie': 'a=1',
        'svix-signature': 'v1,whsecSignatureValue',
      },
      'headers',
    )
    const out = output()
    expect(out).not.toContain('Bearer xyz')
    expect(out).not.toContain('session=abc')
    expect(out).not.toContain('v1,whsecSignatureValue')
  })

  it('locks the canonical redact path list (>= 25 paths)', () => {
    expect(redactPaths.length).toBeGreaterThanOrEqual(25)
  })
})
