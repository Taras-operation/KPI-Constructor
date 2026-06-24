-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL');

-- AlterTable
ALTER TABLE "KPIConfiguration" ADD COLUMN     "periodicity" "Periodicity" NOT NULL DEFAULT 'MONTHLY';
