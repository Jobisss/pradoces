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
 * Phase 1 registrou ZERO domain workers — só provava que a fila subia.
 * Phase 4 adiciona o primeiro job real: expiração diária de pontos (PT-05).
 * Envio de email (NOTIF-01/02) fica pra quando o Resend estiver configurado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { boss } = await import('./lib/queue/boss')
  await boss.start()

  const { expirarPontosVencidos } = await import('./lib/pontos/expirar')
  const QUEUE = 'expirar-pontos'
  await boss.createQueue(QUEUE)
  await boss.work(QUEUE, async () => {
    const { expirados } = await expirarPontosVencidos()
    if (expirados > 0) console.log(`[${QUEUE}] ${expirados} crédito(s) de pontos expirado(s)`)
  })
  // 3h da manhã, horário do negócio — fora do pico de uso do site.
  await boss.schedule(QUEUE, '0 3 * * *', null, { tz: 'America/Sao_Paulo' })
}
