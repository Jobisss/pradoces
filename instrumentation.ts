/**
 * Next.js instrumentation hook (INFRA-11).
 *
 * `register()` runs once when a Next server instance boots, before it handles
 * requests. Next calls it in every runtime, so we guard on NEXT_RUNTIME and only
 * start pg-boss on the Node.js runtime (pg-boss needs a real Postgres pool; it
 * cannot run on the Edge runtime).
 *
 * boss.start() is idempotent and creates the pgboss.* tables on first boot. It
 * runs after Prisma is already connected, so migration order (public.* first,
 * then pgboss.*) holds naturally (T-01-06-02).
 *
 * Phase 1 registers ZERO domain workers — this only proves the queue boots.
 * Phase 4 adds boss.work('send-email', handler) etc. here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { boss } = await import('./lib/queue/boss')
  await boss.start()
}
