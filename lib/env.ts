import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']),
    TZ: z.literal('America/Sao_Paulo'),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    // ME-01: server-side pepper for HMAC-hashing audit IP/UA (keyed, not
    // brute-forceable like unsalted sha256 over the tiny IPv4/UA space).
    AUDIT_HASH_PEPPER: z.string().min(32),
    RESEND_API_KEY: z.string().startsWith('re_'),
    RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    ADMIN_EMAIL: z.string().email(),
    ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
    ADMIN_RESET_PASSWORD: z.string().min(8).optional(),
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    TZ: process.env.TZ,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUDIT_HASH_PEPPER: process.env.AUDIT_HASH_PEPPER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD,
    ADMIN_RESET_PASSWORD: process.env.ADMIN_RESET_PASSWORD,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  },
  emptyStringAsUndefined: true,
})
