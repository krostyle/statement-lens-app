/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_userId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropForeignKey
ALTER TABLE "Statement" DROP CONSTRAINT "Statement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "UserProfile" (
    "clerkId" TEXT NOT NULL,
    "monthlyIncome" INTEGER,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("clerkId")
);

-- NOTE: FK constraints pointing to UserProfile are NOT added here
-- because existing rows have old UUID userId values that don't exist
-- in UserProfile yet. The data migration script (scripts/migrate-userid-to-clerk.ts)
-- updates userId values first; a follow-up migration can add FKs afterwards.
