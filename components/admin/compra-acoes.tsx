'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { excluirCompra } from '@/lib/actions/compras'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/** Ações de compra editável (D-03) — botões de TEXTO, não ícones. */
export function CompraAcoes({ compraId, editHref }: { compraId: string; editHref: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirmarExclusao() {
    setError(null)
    startTransition(async () => {
      const result = await excluirCompra(compraId)
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      toast('Excluído.')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href={editHref} className="font-medium text-foreground underline underline-offset-2">
        Corrigir
      </Link>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="font-medium text-destructive underline underline-offset-2">
            Excluir
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir essa compra?</DialogTitle>
            <DialogDescription>
              Ela ainda não foi usada em nenhum lote, então pode sair sem dó.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-muted-foreground">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Deixa quieto
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmarExclusao}>
              {pending ? 'Excluindo...' : 'Excluir compra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
