-- Add accountType column to Transaction
ALTER TABLE "Transaction" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT '';

-- Add index for origin lookups
CREATE INDEX "Transaction_userId_origin_idx" ON "Transaction"("userId", "origin");

-- Drop Snapshot table (data was only in-memory JSON blobs, no provenance to preserve)
DROP TABLE IF EXISTS "Snapshot";
