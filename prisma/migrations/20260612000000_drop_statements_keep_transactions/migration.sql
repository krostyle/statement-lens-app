-- Removes the statements (PDF) feature while PRESERVING all transactions.
-- Order matters: copy data off the Statement table before dropping anything.

-- Transaction.bank — preserved from the source statement (used by the bank filter)
ALTER TABLE "Transaction" ADD COLUMN "bank" TEXT NOT NULL DEFAULT '';

-- Backfill bank + provenance from the statement each transaction came from.
-- (origin backfill is redundant with the previous migration, kept as a safety net.)
UPDATE "Transaction" t
SET "bank" = s."bank", "origin" = 'statement'
FROM "Statement" s
WHERE t."statementId" = s."id";

-- Detach transactions from statements. This removes the ON DELETE CASCADE
-- relation, so dropping statements can no longer delete transactions.
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_statementId_fkey";
ALTER TABLE "Transaction" DROP COLUMN "statementId";

-- Remove the statements feature
DROP TABLE "Statement";
