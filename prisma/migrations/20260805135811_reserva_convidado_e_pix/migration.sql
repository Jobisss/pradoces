-- CreateEnum
CREATE TYPE "PixTipoChave" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA');

-- AlterTable
ALTER TABLE "configuracoes" ADD COLUMN     "pix_ativo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pix_chave" TEXT,
ADD COLUMN     "pix_cidade" TEXT,
ADD COLUMN     "pix_nome_beneficiario" TEXT,
ADD COLUMN     "pix_tipo_chave" "PixTipoChave";

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "email_convidado" TEXT,
ADD COLUMN     "nome_convidado" TEXT,
ADD COLUMN     "telefone_convidado" TEXT,
ALTER COLUMN "cliente_id" DROP NOT NULL;

-- Reserva de convidado (sem cadastro): ou tem cliente_id (conta), ou tem os 3
-- campos de convidado preenchidos — nunca os dois faltando ao mesmo tempo.
-- Toda linha existente já tem cliente_id preenchido, então essa CHECK é
-- satisfeita trivialmente pelos dados atuais.
ALTER TABLE "reservas" ADD CONSTRAINT reservas_cliente_ou_convidado CHECK (
  cliente_id IS NOT NULL OR (
    nome_convidado IS NOT NULL AND telefone_convidado IS NOT NULL AND email_convidado IS NOT NULL
  )
);
