ALTER TABLE "User"
ADD COLUMN "name" TEXT,
ADD COLUMN "phone" TEXT;

ALTER TABLE "Store"
ADD COLUMN "address" TEXT,
ADD COLUMN "waNumber" TEXT,
ADD COLUMN "midtransServerKey" TEXT,
ADD COLUMN "midtransClientKey" TEXT,
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Subscription"
ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'monthly';

CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'monthly',
    "durationDays" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_isActive_isUsed_idx" ON "ReferralCode"("isActive", "isUsed");

CREATE UNIQUE INDEX "DemoSession_sessionKey_key" ON "DemoSession"("sessionKey");
CREATE INDEX "DemoSession_storeId_idx" ON "DemoSession"("storeId");

ALTER TABLE "ReferralCode"
ADD CONSTRAINT "ReferralCode_usedByUserId_fkey"
FOREIGN KEY ("usedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "DemoSession"
ADD CONSTRAINT "DemoSession_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
