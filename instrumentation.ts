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
 * Phase 4 adicionou o primeiro job real: expiração diária de pontos (PT-05).
 * Phase 5 adiciona o encerramento de sorteios (SORT-04/05/06).
 * Envio de email (NOTIF-01/02) fica pra quando o Resend estiver configurado.
 *
 * Nota sobre "lotes vencidos somem da vitrine" (Phase 5 success criteria #4,
 * sem REQ-ID próprio): já satisfeito SEM cron — lib/catalogo/produtos.ts
 * filtra `validade >= hoje` a cada request, o catálogo público não usa
 * cache/ISR. Um cron só faria sentido se existisse uma camada de cache pra
 * invalidar, que não existe aqui.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { boss } = await import('./lib/queue/boss')
  await boss.start()

  const { expirarPontosVencidos } = await import('./lib/pontos/expirar')
  const EXPIRAR_QUEUE = 'expirar-pontos'
  await boss.createQueue(EXPIRAR_QUEUE)
  await boss.work(EXPIRAR_QUEUE, async () => {
    const { expirados } = await expirarPontosVencidos()
    if (expirados > 0) console.log(`[${EXPIRAR_QUEUE}] ${expirados} crédito(s) de pontos expirado(s)`)
  })
  // 3h da manhã, horário do negócio — fora do pico de uso do site.
  await boss.schedule(EXPIRAR_QUEUE, '0 3 * * *', null, { tz: 'America/Sao_Paulo' })

  const { encerrarSorteiosVencidos } = await import('./lib/sorteios/sortear')
  const SORTEIO_QUEUE = 'encerrar-sorteios'
  await boss.createQueue(SORTEIO_QUEUE)
  await boss.work(SORTEIO_QUEUE, async () => {
    const { encerrados } = await encerrarSorteiosVencidos()
    if (encerrados > 0) console.log(`[${SORTEIO_QUEUE}] ${encerrados} sorteio(s) encerrado(s)`)
  })
  // De hora em hora — prazo de sorteio é um instante exato, não um dia civil.
  await boss.schedule(SORTEIO_QUEUE, '0 * * * *', null, { tz: 'America/Sao_Paulo' })
}
