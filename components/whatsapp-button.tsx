import { MessageCircleIcon } from 'lucide-react'
import { linkWhatsapp } from '@/lib/contato'
import { Button } from '@/components/ui/button'

const MENSAGEM_PADRAO = 'Oi! Vim pelo site da Luizinha e queria saber mais sobre os doces 🙂'

/**
 * CAT-06 — RSC simples (sem client JS: é só um link mailto-like). Enquanto
 * WHATSAPP_NUMERO não estiver configurado (ver lib/contato.ts), some sem
 * quebrar a página — não faz sentido mostrar um botão morto.
 */
export function WhatsappButton({ mensagem = MENSAGEM_PADRAO, className }: { mensagem?: string; className?: string }) {
  const href = linkWhatsapp(mensagem)
  if (!href) return null

  return (
    <Button asChild className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="gap-2">
        <MessageCircleIcon className="size-4" aria-hidden />
        Falar com a confeiteira
      </a>
    </Button>
  )
}
