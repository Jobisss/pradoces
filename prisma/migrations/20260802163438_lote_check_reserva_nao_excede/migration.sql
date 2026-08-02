-- RES-12: defesa em profundidade contra a race condition de estoque —
-- mesmo que a app erre (bug futuro, ou um path que esqueça o SELECT FOR
-- UPDATE), o banco nunca deixa qtde_reservada passar de qtde_disponivel.
ALTER TABLE "lotes" ADD CONSTRAINT lotes_reservada_nao_excede_disponivel CHECK (qtde_reservada <= qtde_disponivel);
