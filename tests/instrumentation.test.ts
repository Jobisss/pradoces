import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the pg-boss singleton so register() never touches a real Postgres — we
// only assert the boot wiring (start() called once, only on the Node runtime).
const { start } = vi.hoisted(() => ({ start: vi.fn(async () => undefined) }))
vi.mock('../lib/queue/boss', () => ({ boss: { start } }))

import { register } from '../instrumentation'

describe('instrumentation.register() — pg-boss boot harness (INFRA-11)', () => {
  const original = process.env.NEXT_RUNTIME

  beforeEach(() => {
    start.mockClear()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_RUNTIME
    else process.env.NEXT_RUNTIME = original
  })

  it('does NOT start pg-boss outside the Node.js runtime (edge)', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    await register()
    expect(start).not.toHaveBeenCalled()
  })

  it('does NOT start pg-boss when NEXT_RUNTIME is unset', async () => {
    delete process.env.NEXT_RUNTIME
    await register()
    expect(start).not.toHaveBeenCalled()
  })

  it('starts pg-boss exactly once on the Node.js runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs'
    await register()
    expect(start).toHaveBeenCalledTimes(1)
  })
})
