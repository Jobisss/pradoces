-- CreateEnum
CREATE TYPE "UnidadeBase" AS ENUM ('g', 'ml', 'un');

-- CreateEnum
CREATE TYPE "TipoIngrediente" AS ENUM ('INGREDIENTE', 'EMBALAGEM');

-- CreateEnum
CREATE TYPE "TipoProduto" AS ENUM ('UNITARIO', 'KIT');

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_base" "UnidadeBase" NOT NULL,
    "tipo" "TipoIngrediente" NOT NULL DEFAULT 'INGREDIENTE',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingrediente_compras" (
    "id" UUID NOT NULL,
    "ingrediente_id" UUID NOT NULL,
    "data_compra" DATE NOT NULL,
    "mercado" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "qtde_embalagens" DECIMAL(10,3) NOT NULL,
    "tamanho_embalagem" DECIMAL(12,3) NOT NULL,
    "preco_por_embalagem" DECIMAL(19,4) NOT NULL,
    "qtde_total_base" DECIMAL(14,3) NOT NULL,
    "preco_total" DECIMAL(19,4) NOT NULL,
    "custo_por_unidade_base" DECIMAL(19,6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingrediente_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "rendimento_padrao" INTEGER NOT NULL,
    "custo_gas" DECIMAL(19,4),
    "validade_dias" INTEGER,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita_ingredientes" (
    "receita_id" UUID NOT NULL,
    "ingrediente_id" UUID NOT NULL,
    "qtde" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "receita_ingredientes_pkey" PRIMARY KEY ("receita_id","ingrediente_id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipo" "TipoProduto" NOT NULL,
    "preco_venda" DECIMAL(19,4) NOT NULL,
    "margem_minima_override" DECIMAL(5,2),
    "receita_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_kit_items" (
    "kit_id" UUID NOT NULL,
    "componente_id" UUID NOT NULL,
    "qtde" INTEGER NOT NULL,

    CONSTRAINT "produto_kit_items_pkey" PRIMARY KEY ("kit_id","componente_id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "receita_id" UUID NOT NULL,
    "multiplicador" DECIMAL(6,2) NOT NULL,
    "rendimento_real" INTEGER NOT NULL,
    "produzido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validade" DATE NOT NULL,
    "qtde_disponivel" INTEGER NOT NULL,
    "qtde_reservada" INTEGER NOT NULL DEFAULT 0,
    "custo_gas_congelado" DECIMAL(19,4) NOT NULL,
    "custo_total_congelado" DECIMAL(19,4) NOT NULL,
    "custo_por_unidade_congelado" DECIMAL(19,6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_uso_ingredientes" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "ingrediente_compra_id" UUID NOT NULL,
    "qtde_usada" DECIMAL(14,3) NOT NULL,
    "marca_snapshot" TEXT NOT NULL,
    "custo_unitario_congelado" DECIMAL(19,6) NOT NULL,
    "custo_congelado" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "lote_uso_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "margem_minima_padrao" DECIMAL(5,2) NOT NULL DEFAULT 30,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_nome_key" ON "ingredientes"("nome");

-- CreateIndex
CREATE INDEX "ingrediente_compras_ingrediente_id_data_compra_idx" ON "ingrediente_compras"("ingrediente_id", "data_compra" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_receita_id_key" ON "produtos"("receita_id");

-- CreateIndex
CREATE INDEX "lotes_validade_idx" ON "lotes"("validade");

-- CreateIndex
CREATE INDEX "lote_uso_ingredientes_ingrediente_compra_id_idx" ON "lote_uso_ingredientes"("ingrediente_compra_id");

-- AddForeignKey
ALTER TABLE "ingrediente_compras" ADD CONSTRAINT "ingrediente_compras_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_ingredientes" ADD CONSTRAINT "receita_ingredientes_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_ingredientes" ADD CONSTRAINT "receita_ingredientes_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_kit_items" ADD CONSTRAINT "produto_kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_kit_items" ADD CONSTRAINT "produto_kit_items_componente_id_fkey" FOREIGN KEY ("componente_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_uso_ingredientes" ADD CONSTRAINT "lote_uso_ingredientes_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_uso_ingredientes" ADD CONSTRAINT "lote_uso_ingredientes_ingrediente_compra_id_fkey" FOREIGN KEY ("ingrediente_compra_id") REFERENCES "ingrediente_compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ING-07 / D-03: compra vira imutável a partir do 1º lote que a referencia.
CREATE OR REPLACE FUNCTION bloquear_compra_referenciada() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lote_uso_ingredientes WHERE ingrediente_compra_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'compra % imutavel: referenciada por lote (custo congelado)', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_imutavel
  BEFORE UPDATE OR DELETE ON "ingrediente_compras"
  FOR EACH ROW EXECUTE FUNCTION bloquear_compra_referenciada();

-- LOTE-04: estoque nunca negativo (defesa contra race da Phase 4 também)
ALTER TABLE "lotes" ADD CONSTRAINT lotes_qtde_disponivel_nao_negativa CHECK (qtde_disponivel >= 0);
ALTER TABLE "lotes" ADD CONSTRAINT lotes_qtde_reservada_nao_negativa  CHECK (qtde_reservada  >= 0);

-- Config single-row (D-10)
ALTER TABLE "configuracoes" ADD CONSTRAINT configuracoes_singleton CHECK (id = 1);
