-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_vip" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "variacoes" ADD COLUMN     "promocao_vip" BOOLEAN NOT NULL DEFAULT false;
