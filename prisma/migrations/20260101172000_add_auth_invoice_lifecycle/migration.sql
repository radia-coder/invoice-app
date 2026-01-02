-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "company_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "invoice_template" TEXT NOT NULL DEFAULT 'classic',
    "default_percent" REAL NOT NULL DEFAULT 12.0,
    "default_tax_percent" REAL NOT NULL DEFAULT 0.0,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "invoice_prefix" TEXT NOT NULL DEFAULT 'INV-',
    "footer_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("address", "created_at", "default_percent", "email", "footer_note", "id", "invoice_prefix", "logo_url", "name", "phone") SELECT "address", "created_at", "default_percent", "email", "footer_note", "id", "invoice_prefix", "logo_url", "name", "phone" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE TABLE "new_Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "week_start" DATETIME NOT NULL,
    "week_end" DATETIME NOT NULL,
    "invoice_date" DATETIME NOT NULL,
    "percent" REAL NOT NULL,
    "tax_percent" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "due_date" DATETIME,
    "sent_at" DATETIME,
    "paid_at" DATETIME,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Invoice_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("company_id", "created_at", "currency", "driver_id", "id", "invoice_date", "invoice_number", "notes", "percent", "updated_at", "week_end", "week_start") SELECT "company_id", "created_at", "currency", "driver_id", "id", "invoice_date", "invoice_number", "notes", "percent", "updated_at", "week_end", "week_start" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");
CREATE INDEX "Invoice_company_id_idx" ON "Invoice"("company_id");
CREATE INDEX "Invoice_driver_id_idx" ON "Invoice"("driver_id");
CREATE INDEX "Invoice_created_at_idx" ON "Invoice"("created_at");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
