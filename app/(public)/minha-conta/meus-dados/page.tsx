import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Seus dados — Luizinha Confeitaria',
}

/**
 * AUTH-09 + LGPD-04 — painel "Meus dados" do cliente (RSC).
 *
 * Vive sob app/(public)/minha-conta/ -> herda o role gate do layout (sem sessão
 * -> /entrar; admin -> /admin, D-06) e o shell Header/Footer (D-03).
 *
 * O export é um link de download para a rota GET: o route handler entrega o
 * JSON como attachment (Content-Disposition), então o próprio navegador baixa o
 * arquivo — sem JS de cliente. O link "Excluir minha conta" é foreground +
 * underline (NÃO destrutivo aqui; o tom destrutivo mora na página /excluir).
 */
export default function MeusDadosPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Seus dados, do seu jeito</h1>
          <p className="text-base text-muted-foreground">
            Você pode baixar tudo o que a gente tem sobre você, ou apagar sua conta. O histórico de
            reservas é mantido por 5 anos por exigência fiscal — depois disso, a gente anonimiza
            tudo.
          </p>
        </header>

        <div className="space-y-4">
          <Button asChild size="lg" className="w-full sm:w-auto">
            {/* download: o route handler já manda Content-Disposition attachment */}
            <a href="/api/me/export" download>
              Baixar meus dados em JSON
            </a>
          </Button>

          <p className="text-sm">
            <Link
              href="/minha-conta/excluir"
              className="text-foreground underline underline-offset-4"
            >
              Excluir minha conta
            </Link>
          </p>
        </div>

        <p className="border-t border-border pt-6 text-sm text-muted-foreground">
          Dúvidas sobre seus dados? Escreva pra:{' '}
          <a
            href="mailto:dpo@luizinhaconfeitaria.com.br"
            className="text-foreground underline underline-offset-4"
          >
            dpo@luizinhaconfeitaria.com.br
          </a>
        </p>
      </div>
    </div>
  )
}
