import { describe, it } from 'vitest'

// Placeholder reserved for Plan 05, when the first Server Action exists.
// next.config.ts already lands experimental.serverActions.allowedOrigins (INFRA-05,
// T-CSRF-01); the runtime assertions below activate once there is an action to POST to.
describe.todo('CSRF Server Actions (INFRA-05, T-CSRF-01)', () => {
  it.todo('rejects POST with Origin header not in allowedOrigins')
  it.todo('accepts POST with Origin matching allowedOrigins')
})
