# Phase 2: Motor Financeiro - Discussion Log

> **Audit trail only.** Não usar como input de planning/research/execução — decisões canônicas estão em 02-CONTEXT.md.

**Date:** 2026-07-03
**Phase:** 02-motor-financeiro
**Mode:** discuss (default)
**Áreas selecionadas:** Registro de compras, Produção de lote, Margem e alertas, Navegação do admin (todas as 4)

## Registro de compras

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Fluxo de registro no dia-a-dia | Ida ao mercado / Item por item / Você decide | **Ida ao mercado** (recomendado) |
| Como informa quantidade | Qtde × tamanho / Total direto / Cadastro de apresentações | **Qtde × tamanho** (recomendado) |
| Erro de digitação vs imutabilidade | Editar até usar em lote / Imutável + estorno / Você decide | **Editar até usar em lote** (recomendado) |
| Mercado/marca | Autocomplete que aprende / Texto livre / Cadastro formal | **Autocomplete que aprende** (recomendado) |

## Produção de lote

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Qual compra congela o custo | Última editável / Sempre última / Manual sempre | **Última compra, editável** (recomendado) |
| Rendimento p/ custo/un | Real / Da receita / Você decide | **Rendimento real** (recomendado) |
| Quantidades do lote | Multiplicador / Sempre 1× / Editável por item | **Multiplicador de receita** (recomendado) |
| Validade | Dias + data calculada / Data direta / Você decide | **Dias + data calculada** (recomendado) |

## Margem e alertas

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Margem vs qual custo | Receita corrente / Último lote / Você decide | **Custo da receita, corrente** (recomendado) |
| Onde configura 30% | Global c/ override / Só global / Só por produto | **Global c/ override por produto** (recomendado) |
| Guardas valem pra kit | Custo = soma / Sem guarda / Só alerta | **Sim, custo = soma** (recomendado) |
| Preço subiu → margem caiu | Alerta home admin / Só ao abrir produto / Você decide | **Sem resposta (AFK)** → Claude's Discretion, recomendação: alerta na home admin |

## Navegação do admin

Não discutida (usuária AFK após área 3). Resolvida como Claude's Discretion no CONTEXT.md; detalhamento delegado ao UI-SPEC (`/gsd-ui-phase 2`).

## Deferred Ideas

- Cadastro de apresentações/embalagens reutilizáveis (v1.x se atrito)
- Fluxo de estorno de compra
- Tabelas formais de marca/mercado
- Ajuste fino de qtde por ingrediente na produção

## Contexto da sessão

Discussão ocorreu enquanto o deploy da Phase 1 (01-05) aguarda registro do domínio `luizinhaconfeitaria.com.br` (checkpoint aberto). Rebrand Doces Valentina → Luizinha Confeitaria aplicado nesta mesma sessão.
