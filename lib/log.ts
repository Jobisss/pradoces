import pino, { type DestinationStream } from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * PII redaction paths (T-PII-01 / INFRA-07). Locked in Wave 0; Phase 2+ APPENDS
 * new paths cumulatively as new PII fields appear — never remove an existing path.
 */
export const redactPaths = [
  'email', '*.email',
  'password', '*.password', 'pwd', '*.pwd',
  'telefone', '*.telefone', 'phone', '*.phone',
  'cpf', '*.cpf',
  'name', 'user.name',
  'token', '*.token', 'session.token',
  'authorization', 'cookie', 'set-cookie',
  'svix-signature',
  'ip', '*.ip', 'req.ip', 'req.headers.x-forwarded-for',
  'user-agent', 'req.headers.user-agent',
]

/**
 * Build a pino logger with the canonical redact config.
 *
 * When `destination` is provided (tests) the pino-pretty worker transport is skipped
 * so output is written synchronously to the given stream — this lets tests assert on
 * the exact serialized JSON. In normal runtime `destination` is undefined: dev uses
 * pino-pretty, prod writes structured JSON to stdout.
 */
export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: isDev ? 'debug' : 'info',
      redact: {
        paths: redactPaths,
        censor: '[redacted]',
        remove: false,
      },
      transport:
        !destination && isDev
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
          : undefined,
    },
    destination,
  )
}

export const logger = createLogger()
