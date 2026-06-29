'use client'

import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth React client — for Phase 2+ Client Components that need to read
 * the session or call auth APIs without a Server Component round-trip. Phase 1
 * forms are `<form action={serverAction}>`, so this is rarely used yet.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_URL,
})
