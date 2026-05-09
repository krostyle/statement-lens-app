CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "checkingTxs" JSONB,
    "ccTxs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserProfile"("clerkId")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Snapshot_userId_month_key" ON "Snapshot"("userId", "month");
