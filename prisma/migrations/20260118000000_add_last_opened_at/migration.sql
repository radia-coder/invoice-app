-- Add last_opened_at column to Invoice and index it.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "last_opened_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Invoice_last_opened_at_idx" ON "Invoice"("last_opened_at");
