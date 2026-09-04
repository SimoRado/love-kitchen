-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER DEFAULT 0;
