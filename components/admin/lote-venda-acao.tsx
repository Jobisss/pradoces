'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { venderLoteParaCliente } from '@/lib/actions/lotes'
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

export type ClienteOpcao = { id: string; name: string; email: string; isVip: boolean }

/**
 * ADM/ESTOQUE — venda direta no balcão: entrega o doce pra um cliente
 * cadastrado na hora, sem reserva prévia. Baixa o estoque e credita os pontos
 * numa transação só (lib/actions/lotes.ts).
 */
export function LoteVendaAcao({
  loteId,
  livre,
  clientes,
}: {
  loteId: string
  livre: number
  clientes: ClienteOpcao[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qtde, setQtde] = useState('1')
  const [clienteId, setClienteId] = useState('')
  const [pago, setPago] = useState(true)
  const [observacao, setObservacao] = useState('')

  function fechar(open: boolean) {
    setOpen(open)
    if (!open) {
      setError(null)
      setQtde('1')
      setClienteId('')
      setPago(true)
      setObservacao('')
    }
  }

  function confirmar() {
    setError(null)
    if (!clienteId) {
      setError('Escolhe pra qual cliente foi.')
      return
    }
    startTransition(async () => {
      const res = await venderLoteParaCliente({ loteId, clienteId, qtde, pago, observacao })
      if (res.error) {
        setError(res.error)
        return
      }
      fechar(false)
      toast(
        res.resumo
          ? `Venda registrada — R$ ${res.resumo.total.replace('.', ',')} · +${res.resumo.pontos} pontos`
          : 'Venda registrada.',
      )
      router.refresh()
    })
  }

  if (livre <= 0) return null

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm font-medium text-primary underline underline-offset-2">
          Vender pra cliente
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vender desse lote</DialogTitle>
          <DialogDescription>
            Pra venda no balcão, sem reserva pelo site. Baixa o estoque, entra no faturamento e credita os
            pontos do cliente na hora. O preço é o que estiver valendo agora (promoção e VIP incluídos).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`venda-cliente-${loteId}`}>Pra quem foi</Label>
            {clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente cadastrado ainda — a venda no balcão precisa de um cadastro pra creditar os
                pontos.
              </p>
            ) : (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id={`venda-cliente-${loteId}`} className="w-full">
                  <SelectValue placeholder="Escolhe o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.isVip ? ' (VIP)' : ''} — {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`venda-qtde-${loteId}`}>
              Quantas unidades ({livre} livre{livre === 1 ? '' : 's'})
            </Label>
            <Input
              id={`venda-qtde-${loteId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={livre}
              value={qtde}
              onChange={(e) => setQtde(e.target.value)}
              className="h-11"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pago}
              onChange={(e) => setPago(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Já pagou
          </label>

          <div className="space-y-1.5">
            <Label htmlFor={`venda-obs-${loteId}`}>Observação (opcional)</Label>
            <Textarea
              id={`venda-obs-${loteId}`}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: levou na sacola de presente"
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
          <Button type="button" disabled={pending || clientes.length === 0} onClick={confirmar}>
            {pending ? 'Registrando...' : 'Registrar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
