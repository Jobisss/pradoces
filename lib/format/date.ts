/**
 * Dois formatadores, porque as colunas de data do schema têm semânticas
 * DIFERENTES e cada uma exige um timeZone diferente pra exibir certo:
 *
 * - `@db.Date` (validade, dataCompra): o Postgres/Prisma grava como
 *   meia-noite UTC representando um DIA CIVIL puro, sem hora nenhuma.
 *   Formatar isso com `timeZone: 'America/Sao_Paulo'` (UTC-3) faz meia-noite
 *   UTC do dia 16 virar 21h do dia 15 — desloca a data em -1 dia. O jeito
 *   certo de ler de volta é `timeZone: 'UTC'` (mesma convenção usada em
 *   `${hoje}T00:00:00Z` em lib/lotes/queries.ts).
 * - `Timestamptz` (produzidoEm, criadoEm): é um INSTANTE real (tem hora de
 *   verdade). Pra saber "em que dia civil isso aconteceu" precisa converter
 *   pro fuso do negócio de verdade — `timeZone: 'America/Sao_Paulo'`.
 */
export const dataCivilFmtBR = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

export const instanteFmtBR = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** Igual instanteFmtBR + hora — pra prazos que importam a que horas exata (ex.: encerramento de sorteio). */
export const datetimeFmtBR = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})
