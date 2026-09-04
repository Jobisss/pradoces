-- Preço sugerido: valor/hora e lucro/hora viram configuração POR RECEITA,
-- com padrão global quando não preenchidos.
--
-- O preço sugerido sai de duas taxas horárias sobre o tempo da receita:
--
--   custo/un   = ingrediente + gás + (min/un ÷ 60) × valor_hora        ← salário
--   sugerido   = custo/un     + (min/un ÷ 60) × lucro_por_hora_alvo    ← lucro
--
-- Duas taxas separadas de propósito: a primeira é o que ela se paga pelo
-- trabalho (entra no custo, derruba a margem, é despesa real); a segunda é o
-- que o NEGÓCIO precisa gerar em cima disso. Misturar as duas foi o que
-- sempre tornou "margem" um número que não decide nada.
--
-- Por receita, porque o mesmo tempo não vale o mesmo em todo doce: um bolo
-- chato de montar pode pedir lucro/hora maior que um brigadeiro que sai em
-- série. NULL = usa o padrão global de configuracoes.
--
-- Deliberadamente NÃO derivado da meta mensal ÷ dias restantes: um preço que
-- sobe porque o mês está atrasado é instável, ignora que volume cai quando
-- preço sobe, e quebra a confiança da clientela de bairro. A meta continua
-- sendo painel de acompanhamento na home, não entrada de precificação.
--
-- Migration ADITIVA (PRODUCTION MODE): colunas novas, nullable ou com
-- default. Nenhum DROP, nenhum UPDATE em linha existente.

ALTER TABLE "receitas"
  ADD COLUMN "valor_hora_mao_de_obra" DECIMAL(19,4),
  ADD COLUMN "lucro_por_hora_alvo" DECIMAL(19,4);

ALTER TABLE "receitas"
  ADD CONSTRAINT receitas_taxas_horarias_nao_negativas
  CHECK (
    ("valor_hora_mao_de_obra" IS NULL OR "valor_hora_mao_de_obra" >= 0)
    AND ("lucro_por_hora_alvo" IS NULL OR "lucro_por_hora_alvo" >= 0)
  );

-- Padrão da casa, usado por toda receita que não tiver o próprio.
ALTER TABLE "configuracoes"
  ADD COLUMN "lucro_por_hora_alvo" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "configuracoes"
  ADD CONSTRAINT configuracoes_lucro_por_hora_nao_negativo
  CHECK ("lucro_por_hora_alvo" >= 0);
