# Brand Kit — Luizinha Confeitaria

*Registrado 2026-07-03 a partir do brand kit fornecido pelo dono (imagem: logo + paleta + tipografia + mockups site/Instagram). Substitui a identidade provisória "Doces Valentina" (accent #9D2D7A).*

## Identidade

- **Nome:** Luizinha Confeitaria
- **Domínio:** `luizinhaconfeitaria.com.br` (registrado via Hostinger/HSTDOMAINS)
- **Mascote:** gatinha de olhos azuis segurando um brownie (versões: logo completo com selo rosa, ícone circular, versão monocromática line-art)
- **Tom:** fofa · delicada · acolhedora · divertida · inconfundível
- **Tagline do kit:** "Feito com amor para deixar seu dia mais doce!"

## Paleta de cores

| Token | Hex | Uso |
|-------|-----|-----|
| Rosa | `#F7B6C6` | Accent de marca → shadcn `--primary` (texto chocolate por cima — 5.3:1 AA) |
| Rosa-claro | `#FFD6E2` | Superfícies suaves, hover, bordas → `--muted`/`--accent`/`--border` |
| Creme | `#FFF3E6` | Fundo dominante → `--background` |
| Caramelo | `#C49A7A` | Decorativo/ilustração (2.6:1 vs branco — NUNCA texto). Livre p/ charts Phase 7 |
| Chocolate | `#6B3E26` | Texto principal → `--foreground` (8.2:1 vs creme), focus ring |
| Azul | `#8ED3F7` | Olhos da mascote — decorativo pontual, não é token de UI |

Aplicada em `app/globals.css` (tokens shadcn) em 2026-07-03. Phase 6 (Sazonalidade) sobrescreve por campanha via CSS vars, como já previsto.

## Tipografia

- **Kit:** wordmark cursivo/script arredondado (estilo "Pacifico/Lobster") + apoio sans.
- **Código hoje:** wordmark usa Fraunces (`--font-display`); corpo Geist Sans.
- **Pendente (decisão Phase 6 ou antes):** trocar `--font-display` por uma script do Google Fonts que aproxime o kit (candidatas: Pacifico, Lobster Two, Borel). Corpo permanece sans legível ≥16px (clientela 50+).

## Padrão decorativo

Pattern rosa com brownies, cupcakes, patinhas e corações — uso em banners/hero/empty states (Phase 3/6).

## Assets pendentes (pedir ao dono)

- [ ] Logo completo PNG/SVG fundo transparente
- [ ] Ícone circular (favicon / app icon / og:image)
- [ ] Versão monocromática
- [ ] Pattern decorativo em tile repetível
