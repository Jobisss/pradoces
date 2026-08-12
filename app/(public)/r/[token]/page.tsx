import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { buscarReservaPorToken } from '@/lib/reservas/queries'
import { dataCivilFmtBR as dateFmt } from '@/lib/format/date'
import { CancelarReservaConvidadoBotao } from '@/components/cancelar-reserva-convidado-botao'
import { PixCopiarCodigo } from '@/components/pix-copiar-codigo'
import { montarPixPayload, gerarPixQrDataUrl } from '@/lib/pix'

const STATUS_GERENCIAVEL = ['PENDENTE', 'CONFIRMADA', 'AGUARDANDO_RETIRADA']

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_COPY: Record<string, string> = {
  PENDENTE: 'Aguardando a Luizinha confirmar',
  CONFIRMADA: 'Confirmada!',
  AGUARDANDO_RETIRADA: 'Pronta pra retirar',
  RETIRADA: 'Retirada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'Não retirada',
}

/** RES-10 — comprovante público, sem login, protegido só pelo token. */
export default async function ComprovantePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [reserva, config] = await Promise.all([
    buscarReservaPorToken(token),
    prisma.configuracao.findUnique({ where: { id: 1 } }),
  ])
  if (!reserva) notFound()

  const total =
    reserva.itens.reduce((soma, i) => soma + i.qtde * Number(i.precoUnitarioCongelado), 0) +
    (reserva.taxaEntregaCongelada ? Number(reserva.taxaEntregaCongelada) : 0)

  // Pix estático com o valor da reserva embutido — só exibição, a confirmação
  // do pagamento continua manual (Reserva.pago). Se der qualquer erro, omite
  // o bloco em vez de derrubar a página do comprovante.
  let pix: { payload: string; qrDataUrl: string } | null = null
  if (
    config?.pixAtivo &&
    config.pixChave &&
    config.pixNomeBeneficiario &&
    config.pixCidade &&
    reserva.tipo !== 'RESGATE' &&
    STATUS_GERENCIAVEL.includes(reserva.status)
  ) {
    try {
      const payload = montarPixPayload({
        chave: config.pixChave,
        nomeBeneficiario: config.pixNomeBeneficiario,
        cidade: config.pixCidade,
        valor: total,
        txid: token,
      })
      pix = { payload, qrDataUrl: await gerarPixQrDataUrl(payload) }
    } catch {
      pix = null
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <p className="text-sm text-muted-foreground">Comprovante de reserva</p>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">
          {STATUS_COPY[reserva.status] ?? reserva.status}
        </h1>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        {reserva.deliveryMode === 'ENTREGA' ? (
          <>
            <p className="text-sm">
              <span className="font-medium">Entrega no endereço: </span>
              {reserva.enderecoEntrega}
            </p>
            <p className="text-sm">
              <span className="font-medium">Quando: </span>
              {reserva.janelaRetirada}
            </p>
          </>
        ) : (
          <p className="text-sm">
            <span className="font-medium">Retirada: </span>
            {reserva.janelaRetirada}
          </p>
        )}
        {reserva.observacao && (
          <p className="text-sm">
            <span className="font-medium">Observação: </span>
            {reserva.observacao}
          </p>
        )}

        {reserva.tipo === 'RESGATE' ? (
          <div className="flex items-center justify-between py-2 text-sm">
            <span>{reserva.itemResgatavel?.produto?.nome ?? reserva.itemResgatavel?.nomeCustom}</span>
            <span className="tabular-nums">{reserva.itemResgatavel?.custoPontos} pontos</span>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {reserva.itens.map((item, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {item.qtde}× {item.lote.produto.nome} — {item.lote.variacao.nome}{' '}
                    <span className="text-muted-foreground">(lote vence {dateFmt.format(item.lote.validade)})</span>
                  </span>
                  <span className="tabular-nums">
                    {currency.format(item.qtde * Number(item.precoUnitarioCongelado))}
                  </span>
                </li>
              ))}
            </ul>
            {reserva.taxaEntregaCongelada !== null && (
              <p className="flex justify-between text-sm text-muted-foreground">
                <span>Entrega</span>
                <span className="tabular-nums">{currency.format(Number(reserva.taxaEntregaCongelada))}</span>
              </p>
            )}
            <p className="tabular-nums text-right text-base font-medium">Total: {currency.format(total)}</p>
          </>
        )}
      </div>

      {pix && (
        <div className="space-y-3 rounded-lg border border-border p-4 text-center">
          <p className="text-sm font-medium">Pagar com Pix</p>
          {/* data: URI gerado no servidor (lib/pix.ts) — next/image não otimiza data URIs, e um <img> simples evita client component só pra isso. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pix.qrDataUrl}
            width={220}
            height={220}
            alt="QR code para pagamento via Pix"
            className="mx-auto"
          />
          <PixCopiarCodigo payload={pix.payload} />
          <p className="text-sm text-muted-foreground">
            A confirmação do pagamento continua manual, direto com a Luizinha.
          </p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Guarda esse link — é o seu comprovante. A Luizinha vai confirmar direto com você.
      </p>

      {!reserva.clienteId && STATUS_GERENCIAVEL.includes(reserva.status) && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Quer acompanhar essa reserva e ganhar pontos nas próximas?</p>
            <p className="text-sm text-muted-foreground">Cria sua conta — é rápido, só falta uma senha.</p>
          </div>
          <Link
            href={`/cadastro?nome=${encodeURIComponent(reserva.nomeConvidado ?? '')}&telefone=${encodeURIComponent(reserva.telefoneConvidado ?? '')}&email=${encodeURIComponent(reserva.emailConvidado ?? '')}&fromReserva=${token}`}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Criar minha conta
          </Link>
          <CancelarReservaConvidadoBotao token={token} />
        </div>
      )}
    </section>
  )
}
