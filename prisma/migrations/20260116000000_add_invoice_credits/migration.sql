-- CreateTable
CREATE TABLE "InvoiceCredit" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "credit_type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "InvoiceCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceCredit_invoice_id_idx" ON "InvoiceCredit"("invoice_id");

-- CreateIndex
CREATE INDEX "InvoiceCredit_credit_type_idx" ON "InvoiceCredit"("credit_type");

-- AddForeignKey
ALTER TABLE "InvoiceCredit" ADD CONSTRAINT "InvoiceCredit_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
