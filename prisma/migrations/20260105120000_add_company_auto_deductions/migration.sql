-- Add auto deduction settings to Company
ALTER TABLE "Company" ADD COLUMN "factoring_rate" REAL NOT NULL DEFAULT 2.0;
ALTER TABLE "Company" ADD COLUMN "dispatch_rate" REAL NOT NULL DEFAULT 6.0;
ALTER TABLE "Company" ADD COLUMN "auto_deduction_base" TEXT NOT NULL DEFAULT 'YTD_INSURANCE';
