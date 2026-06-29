'use client'

import { Toaster as ShadcnToaster } from '@/components/ui/sonner'

/**
 * Provider de toast global (sonner) — montado uma vez no root layout.
 *
 * UI-SPEC §Interaction: top-center (mobile-first; sonner não suporta posição
 * responsiva nativa — top-center lê bem em ambos), sempre dismissable (closeButton).
 * Duração padrão 5s (success); chamadas de erro passam `duration: 8000` no call site
 * (Plans 08/11). T-01-07-01: é o único 'use client' do shell — não injeta <script>
 * inline sem nonce.
 */
export function Toaster() {
  return <ShadcnToaster position="top-center" duration={5000} richColors closeButton />
}
