-- CreateTable
CREATE TABLE "CreditType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditType_company_id_idx" ON "CreditType"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "CreditType_name_company_id_key" ON "CreditType"("name", "company_id");

-- AddForeignKey
ALTER TABLE "CreditType" ADD CONSTRAINT "CreditType_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default credit types
INSERT INTO "CreditType" ("name", "company_id", "is_default") VALUES
('Advance', NULL, true),
('Bonus', NULL, true),
('Reimbursement', NULL, true),
('Detention', NULL, true),
('Layover', NULL, true),
('Other', NULL, true);
