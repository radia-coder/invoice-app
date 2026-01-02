-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "whatsapp_number" TEXT;
ALTER TABLE "Driver" ADD COLUMN "whatsapp_link" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "public_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_public_token_key" ON "Invoice"("public_token");
