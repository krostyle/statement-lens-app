-- Add reviewStatus column to Transaction
-- Existing rows default to 'pending' (never reviewed)
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'pending';
