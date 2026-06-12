-- CreateTable
CREATE TABLE "TrackingUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingUpload_userId_idx" ON "TrackingUpload"("userId");
CREATE INDEX "TrackingUpload_userId_month_idx" ON "TrackingUpload"("userId", "month");

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "trackingUploadId" TEXT;

-- AddForeignKey
ALTER TABLE "TrackingUpload" ADD CONSTRAINT "TrackingUpload_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserProfile"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_trackingUploadId_fkey"
    FOREIGN KEY ("trackingUploadId") REFERENCES "TrackingUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
