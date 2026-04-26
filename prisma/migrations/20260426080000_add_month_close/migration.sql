-- Add month to Budget (set existing rows to current month as a one-time default)
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "month" TEXT NOT NULL DEFAULT '2026-04';

-- Remove the temporary default — month must always be provided explicitly going forward
ALTER TABLE "Budget" ALTER COLUMN "month" DROP DEFAULT;

-- Drop old unique index [userId, categoryId] (created as INDEX in the original migration)
DROP INDEX IF EXISTS "Budget_userId_categoryId_key";

-- Add new unique constraint [userId, categoryId, month]
CREATE UNIQUE INDEX "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month");

-- CreateTable MonthClose
CREATE TABLE "MonthClose" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalSpent" DOUBLE PRECISION NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "summary" JSONB NOT NULL,
    "aiSuggestions" TEXT NOT NULL,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthClose_userId_month_key" ON "MonthClose"("userId", "month");

ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserProfile"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;
