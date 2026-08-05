'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function PixCopiarCodigo({ payload }: { payload: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(payload)
      toast('Copiado!')
    } catch {
      toast('Não deu pra copiar automaticamente — seleciona o texto manualmente.')
    }
  }

  return (
    <div className="space-y-2">
      <p className="break-all rounded-lg border border-border bg-muted p-2 font-mono text-xs">{payload}</p>
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={copiar}>
        Copiar código Pix
      </Button>
    </div>
  )
}
