import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { listarSorteiosAbertos, listarSorteiosEncerrados } from '@/lib/sorteios/queries'
import { saldoPontos } from '@/lib/pontos/queries'
import { datetimeFmtBR } from '@/lib/format/date'
import { MinhaContaNav } from '@/components/minha-conta-nav'
import { ComprarChanceBotao } from '@/components/comprar-chance-botao'

export const metadata = { title: 'Sorteios — Luizinha Confeitaria' }

/** SORT-03/07. */
export default async function SorteiosPage() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  const clienteId = session!.user.id
  const [abertos, encerrados, saldo] = await Promise.all([
    listarSorteiosAbertos(clienteId),
    listarSorteiosEncerrados(),
    saldoPontos(clienteId),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-12">
      <MinhaContaNav ativo="/minha-conta/sorteios" />
      <div>
        <h1 className="font-display text-3xl font-semibold">Sorteios</h1>
        <p className="tabular-nums text-sm text-muted-foreground">Você tem {saldo} pts</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Abertos</h2>
        {abertos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sorteio aberto no momento.</p>
        ) : (
          <ul className="space-y-3">
            {abertos.map((s) => (
              <li key={s.id} className="space-y-2 rounded-lg border border-border p-4">
                <div>
                  <p className="text-base font-medium">{s.nome}</p>
                  <p className="text-sm text-muted-foreground">{s.premio}</p>
                </div>
                <p className="tabular-nums text-sm text-muted-foreground">
                  {s.custoPontos} pts/chance · encerra em {datetimeFmtBR.format(s.prazo)} · você tem{' '}
                  {s.minhasChances}/{s.capPorCliente} chance(s)
                </p>
                <ComprarChanceBotao sorteioId={s.id} esgotadoPeloCap={s.minhasChances >= s.capPorCliente} />
              </li>
            ))}
          </ul>
        )}
        {abertos.length > 0 && (
          <Link href="/termos-sorteio" className="text-sm text-primary underline underline-offset-2">
            Termos do sorteio
          </Link>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Sorteios passados</h2>
        {encerrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sorteio encerrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {encerrados.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <span className="font-medium">{s.nome}</span> — vencedor: {s.vencedor?.name ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
