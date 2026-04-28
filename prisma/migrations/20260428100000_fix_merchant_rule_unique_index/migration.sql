-- Fix merchant rule unique index.
-- The previous migration used DROP CONSTRAINT on what was actually a unique INDEX,
-- so the old 2-column index may still exist alongside the new 3-column one.
-- This migration is fully idempotent and handles all possible DB states.

-- 1. Ensure the bank column exists (in case the previous migration didn't run)
ALTER TABLE "MerchantRule" ADD COLUMN IF NOT EXISTS "bank" TEXT NOT NULL DEFAULT '';

-- 2. Drop the old 2-column unique index with both possible names
--    (INDEX, not CONSTRAINT — use DROP INDEX, not ALTER TABLE DROP CONSTRAINT)
DROP INDEX IF EXISTS "MerchantRule_userId_merchantPattern_key";
-- Also drop as a constraint in case some environments created it that way
ALTER TABLE "MerchantRule" DROP CONSTRAINT IF EXISTS "MerchantRule_userId_merchantPattern_key";

-- 3. Ensure the correct 3-column unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantRule_userId_merchantPattern_bank_key"
  ON "MerchantRule"("userId", "merchantPattern", "bank");
