-- Programa de pontos passa a ser lastreado em LUCRO, não em faturamento.
--
-- Antes: ponto = real gasto pelo cliente, e o preço em pontos de cada item de
-- resgate era um número digitado à mão. Duas consequências ruins: um doce de
-- margem péssima custava os mesmos pontos de um de margem ótima, e o preço em
-- pontos não acompanhava a alta do ingrediente.
--
-- Agora: ponto = real de LUCRO que o cliente gerou, e o preço em pontos de um
-- item sai de uma conta só — quanto do lucro a casa devolve em brinde:
--
--   pontos = custo_corrente_do_doce ÷ (pontos_devolucao_percent / 100)
--
-- Ancorado no CUSTO e não no lucro do próprio item porque, produzindo sob
-- encomenda, o doce dado de brinde não tomou o lugar de uma venda: o que sai
-- do bolso é o ingrediente. Efeito colateral desejado — produto mal
-- precificado fica automaticamente caro de resgatar.
--
-- Migration puramente ADITIVA (PRODUCTION MODE): coluna nova com default, sem
-- DROP e sem UPDATE em linha existente. O saldo de pontos já emitido continua
-- valendo como está, por decisão do dono — quem acumulou sob a regra antiga
-- leva uma vantagem pontual, e isso é aceito.
ALTER TABLE "configuracoes"
  ADD COLUMN "pontos_devolucao_percent" DECIMAL(5,2) NOT NULL DEFAULT 15;

-- Faixa sã: devolver 0% desliga o resgate na prática, e acima de 100% a casa
-- estaria dando mais brinde do que lucro.
ALTER TABLE "configuracoes"
  ADD CONSTRAINT configuracoes_pontos_devolucao_faixa
  CHECK ("pontos_devolucao_percent" > 0 AND "pontos_devolucao_percent" <= 100);
