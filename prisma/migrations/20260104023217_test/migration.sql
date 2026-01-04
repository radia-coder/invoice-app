-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "truck_number" TEXT;

-- CreateTable
CREATE TABLE "UserSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "city" TEXT,
    "country" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    CONSTRAINT "UserSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "company_id" INTEGER,
    "export_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "driver_ids" TEXT,
    "exported_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_session_token_key" ON "UserSession"("session_token");

-- CreateIndex
CREATE INDEX "UserSession_user_id_idx" ON "UserSession"("user_id");

-- CreateIndex
CREATE INDEX "UserSession_session_token_idx" ON "UserSession"("session_token");

-- CreateIndex
CREATE INDEX "UserSession_is_active_idx" ON "UserSession"("is_active");

-- CreateIndex
CREATE INDEX "ExportLog_company_id_idx" ON "ExportLog"("company_id");

-- CreateIndex
CREATE INDEX "ExportLog_exported_at_idx" ON "ExportLog"("exported_at");
