'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { darBaixaLote } from '@/lib/actions/lotes'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MOTIVOS = [
  { value: 'VENCIDO', label: 'Venceu sem vender' },
  { value: 'DANIFICADO', label: 'Estragou / danificou' },
  { value: 'OUTRO', label: 'Outro motivo' },
] as const

/** ADM/ESTOQUE — baixa manual de estoque sem venda (venceu, estragou, etc). */
export function LoteBaixaAcao({ loteId, livre }: { loteId: string; livre: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qtde, setQtde] = useState('1')
  const [motivo, setMotivo] = useState<string>('VENCIDO')
  const [observacao, setObservacao] = useState('')

  function fechar(open: boolean) {
    setOpen(open)
    if (!open) {
      setError(null)
      setQtde('1')
      setMotivo('VENCIDO')
      setObservacao('')
    }
  }

  function confirmar() {
    setError(null)
    startTransition(async () => {
      const res = await darBaixaLote({ loteId, qtde, motivo, observacao })
      if (res.error) {
        setError(res.error)
        return
      }
      fechar(false)
      toast('Baixa registrada.')
      router.refresh()
    })
  }

  if (livre <= 0) return null

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm font-medium text-destructive underline underline-offset-2">
          Dar baixa
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa nesse lote</DialogTitle>
          <DialogDescription>
            Pra quando não deu pra vender a tempo (venceu, estragou). Isso tira do estoque sem virar venda —
            não afeta faturamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="baixa-qtde">Quantas unidades ({livre} livre{livre === 1 ? '' : 's'})</Label>
            <Input
              id="baixa-qtde"
              type="number"
              inputMode="numeric"
              min={1}
              max={livre}
              value={qtde}
              onChange={(e) => setQtde(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baixa-motivo">Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="baixa-motivo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baixa-obs">Observação (opcional)</Label>
            <Textarea
              id="baixa-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: ficou fora da geladeira demais"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => fechar(false)}>
            Deixa quieto
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirmar}>
            {pending ? 'Baixando...' : 'Confirmar baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
