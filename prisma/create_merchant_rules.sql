CREATE TABLE IF NOT EXISTS "MerchantRule" (
  "id"              TEXT        NOT NULL,
  "userId"          TEXT        NOT NULL,
  "merchantPattern" TEXT        NOT NULL,
  "categoryId"      TEXT        NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantRule_userId_merchantPattern_key" UNIQUE ("userId", "merchantPattern"),
  CONSTRAINT "MerchantRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserProfile"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MerchantRule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
