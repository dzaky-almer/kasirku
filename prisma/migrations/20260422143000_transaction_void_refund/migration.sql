ALTER TABLE "Transaction"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "refundReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3);

CREATE INDEX "Transaction_storeId_status_createdAt_idx"
ON "Transaction"("storeId", "status", "createdAt");
