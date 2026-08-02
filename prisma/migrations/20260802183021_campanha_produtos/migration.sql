-- CreateTable
CREATE TABLE "campanha_produtos" (
    "campanha_id" TEXT NOT NULL,
    "produto_id" UUID NOT NULL,

    CONSTRAINT "campanha_produtos_pkey" PRIMARY KEY ("campanha_id","produto_id")
);

-- AddForeignKey
ALTER TABLE "campanha_produtos" ADD CONSTRAINT "campanha_produtos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
