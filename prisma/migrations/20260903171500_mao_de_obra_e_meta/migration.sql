-- Mão de obra vira LINHA DE CUSTO, e a casa ganha uma meta de lucro mensal.
--
-- Até aqui `custo = ingredientes + gás`. O trabalho da confeiteira não
-- aparecia em lugar nenhum, então "sobrou R$ 100" na verdade queria dizer
-- "sobrou R$ 100 E o pagamento das 3 horas que eu passei enrolando
-- brigadeiro" — misturado, sem separação possível. Margem sozinha não
-- distingue 60% num doce que toma 2 horas de 40% num que toma 15 minutos.
--
-- Modelado como TEMPO, não como valor fixo (que seria um clone do custoGas):
--
--   custo_mao_de_obra = minutos_preparo × multiplicador × (valor_hora / 60)
--
-- Assim, aumentar o próprio salário é mexer em UM número global, não reabrir
-- receita por receita. E, com minuto registrado, dá pra responder "quanto eu
-- ganho por hora neste produto?", que é a pergunta que importa pra quem
-- produz em casa.
--
-- Migration ADITIVA (PRODUCTION MODE): colunas novas com default, nenhum
-- DROP, nenhum UPDATE em linha existente. Lote já produzido continua com o
-- custo congelado que tinha — não dá pra saber retroativamente quanto tempo
-- cada fornada levou, e inventar seria pior que o degrau no histórico.

-- Tempo de preparo de UM lote padrão da receita. NULL = ainda não medido,
-- e nesse caso a mão de obra entra como zero (mesmo tratamento do custoGas).
ALTER TABLE "receitas"
  ADD COLUMN "minutos_preparo" INTEGER;

ALTER TABLE "receitas"
  ADD CONSTRAINT receitas_minutos_preparo_positivo
  CHECK ("minutos_preparo" IS NULL OR "minutos_preparo" > 0);

-- Quanto a confeiteira se paga por hora. Default 0 pra que a conta não mude
-- sozinha no dia do deploy: só passa a valer quando ela configurar em Ajustes.
ALTER TABLE "configuracoes"
  ADD COLUMN "valor_hora_mao_de_obra" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- Meta de lucro do mês, JÁ DESCONTADA a mão de obra — é o que sobra depois
-- de ela se pagar. 0 = sem meta definida (a home esconde o bloco).
ALTER TABLE "configuracoes"
  ADD COLUMN "meta_lucro_mensal" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "configuracoes"
  ADD CONSTRAINT configuracoes_valores_nao_negativos
  CHECK ("valor_hora_mao_de_obra" >= 0 AND "meta_lucro_mensal" >= 0);

-- Congelado junto com o resto do custo do lote, mesmo padrão do
-- custo_gas_congelado: se ela aumentar o próprio salário amanhã, o lote de
-- hoje continua valendo o que valeu hoje.
ALTER TABLE "lotes"
  ADD COLUMN "custo_mao_de_obra_congelado" DECIMAL(19,4) NOT NULL DEFAULT 0;
