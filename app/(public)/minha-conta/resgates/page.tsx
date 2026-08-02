import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { listarItensResgataveisDisponiveis } from '@/lib/resgate/queries'
import { saldoPontos } from '@/lib/pontos/queries'
import { MinhaContaNav } from '@/components/minha-conta-nav'
import { ResgatarItemBotao } from '@/components/resgatar-item-botao'

export const metadata = { title: 'Trocar pontos — Luizinha Confeitaria' }

/** RESG-03/06 — catálogo de resgate do cliente. */
export default async function ResgatesPage() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const [itens, saldo] = await Promise.all([listarItensResgataveisDisponiveis(), saldoPontos(session!.user.id)])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <MinhaContaNav ativo="/minha-conta/resgates" />
      <div>
        <h1 className="font-display text-3xl font-semibold">Trocar pontos</h1>
        <p className="tabular-nums text-sm text-muted-foreground">Você tem {saldo} pts</p>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada disponível pra troca no momento.</p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-base font-medium">{item.produto?.nome ?? item.nomeCustom}</p>
                <p className="tabular-nums text-sm text-muted-foreground">{item.custoPontos} pts</p>
              </div>
              <ResgatarItemBotao
                itemId={item.id}
                nome={item.produto?.nome ?? item.nomeCustom ?? 'esse item'}
                custoPontos={item.custoPontos}
                saldoAtual={saldo}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
