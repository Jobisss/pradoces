-- Espelha o padrão XOR de itens_resgataveis: endereco_entrega/taxa_entrega_congelada
-- só existem junto com delivery_mode='ENTREGA', nunca soltos nem faltando.
ALTER TABLE "reservas" ADD CONSTRAINT reservas_entrega_endereco_xor CHECK (
  (delivery_mode = 'PICKUP_ONLY' AND endereco_entrega IS NULL AND taxa_entrega_congelada IS NULL)
  OR
  (delivery_mode = 'ENTREGA' AND endereco_entrega IS NOT NULL AND taxa_entrega_congelada IS NOT NULL)
);
