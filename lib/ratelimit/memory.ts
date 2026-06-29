import { RateLimiterMemory } from 'rate-limiter-flexible'

/**
 * In-memory rate limiters (RESEARCH §Rate Limit — override of @upstash/ratelimit,
 * which has no memory mode and requires Redis).
 *
 * `await limiter.consume(key)` resolves with a RateLimiterRes while under budget
 * and rejects (throws RateLimiterRes) once the window is exhausted. Callers wrap
 * it in try/catch (proxy boundary) or `.catch(() => null)` (Server Actions).
 *
 * Trade-off: state is per-process and resets on restart (T-01-06-03, accepted for
 * v1 single-VPS). Shared in-process between the proxy.ts boundary throttle and the
 * Plan 08 Server Actions (defense in depth) because the proxy runs the Node runtime.
 *
 * NOTE: rate-limiter-flexible is fixed-window-with-reset, not true sliding window.
 * Acceptable at Phase 1 volume; revisit (BurstyRateLimiter / RateLimiterPostgres)
 * if bairro volume ever justifies it.
 */

// Per-IP em /api/auth/* — 10 req / 60s, bloqueia 60s ao estourar.
export const rateLimitAuth = new RateLimiterMemory({
  keyPrefix: 'auth-ip',
  points: 10,
  duration: 60,
  blockDuration: 60,
})

// Per-email em /api/auth/esqueci-senha — 3 req / 15min, bloqueia 15min.
export const rateLimitForgotEmail = new RateLimiterMemory({
  keyPrefix: 'forgot-email',
  points: 3,
  duration: 60 * 15,
  blockDuration: 60 * 15,
})
