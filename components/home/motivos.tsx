/**
 * Motivos da marca em SVG — patinha, coração e brownie em line-art.
 *
 * Por que existem: o brand kit (.planning/BRAND.md) pede a mascote e um pattern
 * decorativo, e nenhum dos dois existe como asset utilizável. A gatinha só
 * aparece em `public/logo/logo-com-gato.png`, onde o wordmark cobre o corpo dela
 * e há uma vinheta cinza queimada no fundo — em cima do creme vira mancha.
 *
 * Então os motivos aqui NÃO inventam identidade nova: são os outros elementos
 * que já estão desenhados dentro do próprio logo. Quando o recorte da gatinha
 * chegar (item pendente no BRAND.md), ela entra por cima disso sem refazer nada.
 *
 * Tudo decorativo: `aria-hidden` em todos, e o caramelo (#C49A7A, 2.6:1) só
 * aparece como traço em opacidade baixa — nunca como texto.
 */

/**
 * Textura de fundo. `<pattern>` em vez de imagem repetida: escala em qualquer
 * tamanho de faixa sem asset, sem request e sem custo de banda.
 *
 * `id` é obrigatório e precisa ser único NA PÁGINA — dois `<pattern>` com o
 * mesmo id fazem o segundo referenciar o primeiro (o navegador resolve por
 * documento, não por elemento), e a faixa de baixo herda a cor da de cima.
 */
export function TexturaMotivos({
  id,
  cor,
  opacidade = 0.085,
  className,
}: {
  id: string
  cor: string
  opacidade?: number
  className?: string
}) {
  return (
    <svg className={className} aria-hidden style={{ opacity: opacidade }}>
      <defs>
        <pattern id={id} width="150" height="130" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <g fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {/* coração */}
            <path d="M24 40c-9-7.5-15-12.5-15-20a8.5 8.5 0 0 1 15-5 8.5 8.5 0 0 1 15 5c0 7.5-6 12.5-15 20z" />
            {/* patinha */}
            <ellipse cx="104" cy="36" rx="9" ry="7.5" />
            <circle cx="93" cy="22" r="3.6" />
            <circle cx="104" cy="18" r="3.6" />
            <circle cx="115" cy="22" r="3.6" />
            {/* brownie */}
            <rect x="48" y="88" width="32" height="24" rx="4" />
            <path d="M48 96h32M62 88v24" />
            {/* floreio */}
            <path d="M118 96c6-6 12 0 18-4" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Sacola — passo "escolhe e reserva". Mesmo desenho do carrinho no header. */
export function IconeSacola({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

/** Balão com coração — passo "ela confirma no WhatsApp". */
export function IconeConversa({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-12.1 7.5L3 21l2-5.8A8.4 8.4 0 1 1 21 11.5z" />
      <path d="M12 13.6c-2.2-1.8-3.6-3-3.6-4.5a2 2 0 0 1 3.6-1.1 2 2 0 0 1 3.6 1.1c0 1.5-1.4 2.7-3.6 4.5z" />
    </svg>
  )
}

/** Patinha — passo "retira e paga na hora". */
export function IconePatinha({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="16" rx="5" ry="4.2" />
      <circle cx="6" cy="8.5" r="2.2" />
      <circle cx="11" cy="6" r="2.2" />
      <circle cx="16.5" cy="7.5" r="2.2" />
      <circle cx="20" cy="12" r="2.2" />
    </svg>
  )
}

/** Cupcake — usado nos empty states, onde não há foto nenhuma pra mostrar. */
export function IconeCupcake({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 14h10l-1.1 6.2a1.4 1.4 0 0 1-1.4 1.1H9.5a1.4 1.4 0 0 1-1.4-1.1z" />
      <path d="M12 4.5c2 0 3.2 1.4 3.2 2.8 1.2.2 1.8 1.2 1.8 2.2 0 1.6-1.4 2.5-3.2 2.5h-3.6C8.4 12 7 11.1 7 9.5c0-1 .6-2 1.8-2.2C8.8 5.9 10 4.5 12 4.5z" />
    </svg>
  )
}
