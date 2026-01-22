-- Add "Credit" as a default credit type
INSERT INTO "CreditType" ("name", "company_id", "is_default")
VALUES ('Credit', NULL, true)
ON CONFLICT ("name", "company_id") DO NOTHING;
