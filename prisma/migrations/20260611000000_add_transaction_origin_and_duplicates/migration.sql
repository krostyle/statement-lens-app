-- Transaction.origin — provenance of the row: 'statement' | 'tracking' | 'manual'
ALTER TABLE "Transaction" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual';

-- Backfill: rows linked to a statement were created by PDF processing
UPDATE "Transaction" SET "origin" = 'statement' WHERE "statementId" IS NOT NULL;

-- Speeds up duplicate lookups by user + date range
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- Statement.duplicatesSkipped — charges omitted during processing because they already existed
ALTER TABLE "Statement" ADD COLUMN "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0;
