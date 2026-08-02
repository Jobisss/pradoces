'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resgatarItem } from '@/lib/actions/resgate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ResgatarItemBotao({
  itemId,
  nome,
  custoPontos,
  saldoAtual,
}: {
  itemId: string
  nome: string
  custoPontos: number
  saldoAtual: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [janela, setJanela] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const semSaldo = saldoAtual < custoPontos

  function confirmar() {
    setErro(null)
    if (!janela.trim()) {
      setErro('Diz quando prefere retirar.')
      return
    }
    startTransition(async () => {
      const res = await resgatarItem(itemId, janela)
      if (res.error) {
        setErro(res.error)
        return
      }
      setOpen(false)
      router.push(`/r/${res.token}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9" disabled={semSaldo}>
          {semSaldo ? 'Pontos insuficientes' : 'Trocar'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar por {nome}?</DialogTitle>
          <DialogDescription>
            Vai debitar {custoPontos} pontos na hora. A Luizinha ainda confirma antes de você retirar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="resgate-janela">Quando prefere retirar?</Label>
          <Input id="resgate-janela" value={janela} onChange={(e) => setJanela(e.target.value)} placeholder="Ex.: amanhã de manhã" />
        </div>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Deixa quieto
          </Button>
          <Button type="button" disabled={pending} onClick={confirmar}>
            {pending ? 'Trocando...' : 'Confirmar troca'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
