import 'server-only'
import { env } from '@/lib/env'

/** CAT-06/07 — dados de contato ainda não cadastrados (ver .env.example). */

export function linkWhatsapp(mensagem: string): string | null {
  if (!env.WHATSAPP_NUMERO) return null
  return `https://wa.me/${env.WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`
}

export function enderecoRetirada(): { texto: string; observacao: string | null; mapsUrl: string | null } | null {
  if (!env.ENDERECO_RETIRADA) return null
  return {
    texto: env.ENDERECO_RETIRADA,
    observacao: env.ENDERECO_OBSERVACAO ?? null,
    mapsUrl: env.ENDERECO_MAPS_URL ?? null,
  }
}
