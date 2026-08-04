import { painelDoDia } from '@/lib/admin/painel-dia'
import { BotaoImprimir } from '@/components/admin/botao-imprimir'

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADA: 'Confirmada',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
}

/** ADM-02/03 — mesma tela serve de painel e de lista de separação impressa (botão chama window.print()). */
export default async function PainelDoDiaPage() {
  const grupos = await painelDoDia()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:block">
        <h1 className="font-display text-3xl font-semibold">Painel do dia</h1>
        <BotaoImprimir />
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma retirada prevista no momento.</p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.janela} className="space-y-3 break-inside-avoid">
              <h2 className="border-b border-border pb-1 text-lg font-semibold">{g.janela}</h2>
              <ul className="space-y-3">
                {g.reservas.map((r) => (
                  <li key={r.id} className="space-y-1 rounded-lg border border-border p-3 print:break-inside-avoid">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {r.clienteNome}
                        {r.deliveryMode === 'ENTREGA' && (
                          <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-normal">
                            Entrega
                          </span>
                        )}
                      </p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs print:hidden">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    {r.deliveryMode === 'ENTREGA' && r.enderecoEntrega && (
                      <p className="text-sm font-medium">{r.enderecoEntrega}</p>
                    )}
                    {r.clienteTelefone && <p className="text-sm text-muted-foreground">{r.clienteTelefone}</p>}
                    <ul className="text-sm">
                      {r.itens.map((item, i) => (
                        <li key={i} className="tabular-nums">
                          {item.qtde}× {item.nome}
                        </li>
                      ))}
                    </ul>
                    {r.observacao && <p className="text-sm italic text-muted-foreground">Obs: {r.observacao}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
