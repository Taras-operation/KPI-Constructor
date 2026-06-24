-- AlterTable
ALTER TABLE "KPIConfiguration" ADD COLUMN     "requiredOverrides" JSONB NOT NULL DEFAULT '[]';
