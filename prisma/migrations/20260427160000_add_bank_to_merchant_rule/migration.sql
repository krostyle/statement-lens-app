-- Add bank column to MerchantRule (empty string = any card)
ALTER TABLE "MerchantRule" ADD COLUMN IF NOT EXISTS "bank" TEXT NOT NULL DEFAULT '';

-- Replace the old unique constraint (merchantPattern only) with the new composite one
ALTER TABLE "MerchantRule" DROP CONSTRAINT IF EXISTS "MerchantRule_userId_merchantPattern_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantRule_userId_merchantPattern_bank_key"
  ON "MerchantRule"("userId", "merchantPattern", "bank");
