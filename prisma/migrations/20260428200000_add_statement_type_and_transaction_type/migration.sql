-- Add statementType to Statement (default 'credit_card' for all existing rows)
ALTER TABLE "Statement" ADD COLUMN IF NOT EXISTS "statementType" TEXT NOT NULL DEFAULT 'credit_card';

-- Add transactionType to Transaction (default 'expense' for all existing rows)
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "transactionType" TEXT NOT NULL DEFAULT 'expense';
