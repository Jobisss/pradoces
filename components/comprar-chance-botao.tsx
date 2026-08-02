'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { comprarChance } from '@/lib/actions/sorteio-chances'
import { Button } from '@/components/ui/button'

export function ComprarChanceBotao({ sorteioId, esgotadoPeloCap }: { sorteioId: string; esgotadoPeloCap: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function comprar() {
    setErro(null)
    startTransition(async () => {
      const res = await comprarChance(sorteioId)
      if (res.error) {
        setErro(res.error)
        return
      }
      toast('Chance comprada — boa sorte!')
      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <Button size="sm" className="h-9" disabled={pending || esgotadoPeloCap} onClick={comprar}>
        {esgotadoPeloCap ? 'Limite atingido' : pending ? 'Comprando...' : 'Comprar chance'}
      </Button>
      {erro && (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
