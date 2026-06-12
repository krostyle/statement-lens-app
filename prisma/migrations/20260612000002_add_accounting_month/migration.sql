-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "accountingMonth" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Transaction_userId_accountingMonth_idx" ON "Transaction"("userId", "accountingMonth");
