ALTER TABLE "Store"
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "bookingGraceMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "bookingOpenTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS "bookingCloseTime" TEXT NOT NULL DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS "bookingSlotMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "bookingDurationMin" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Store_slug_key" ON "Store"("slug");

CREATE TABLE IF NOT EXISTS "BookingResource" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "resourceId" TEXT,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ONLINE',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerNote" TEXT,
  "bookingDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT,
  "pax" INTEGER,
  "areaLabel" TEXT,
  "barberName" TEXT,
  "dpAmount" INTEGER NOT NULL DEFAULT 0,
  "dpStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  "paymentOrderId" TEXT,
  "paymentStatusRaw" TEXT,
  "dpPaidAt" TIMESTAMP(3),
  "checkInAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "noShowAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BookingItem" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "productId" TEXT,
  "name" TEXT NOT NULL,
  "itemType" TEXT NOT NULL DEFAULT 'PRODUCT',
  "qty" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" INTEGER NOT NULL DEFAULT 0,
  "durationMin" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_paymentOrderId_key" ON "Booking"("paymentOrderId");
CREATE INDEX IF NOT EXISTS "BookingResource_storeId_type_isActive_idx" ON "BookingResource"("storeId", "type", "isActive");
CREATE INDEX IF NOT EXISTS "Booking_storeId_bookingDate_status_idx" ON "Booking"("storeId", "bookingDate", "status");
CREATE INDEX IF NOT EXISTS "Booking_resourceId_bookingDate_status_idx" ON "Booking"("resourceId", "bookingDate", "status");
CREATE INDEX IF NOT EXISTS "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingItem_productId_idx" ON "BookingItem"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingResource_storeId_fkey'
  ) THEN
    ALTER TABLE "BookingResource"
    ADD CONSTRAINT "BookingResource_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_storeId_fkey'
  ) THEN
    ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_resourceId_fkey'
  ) THEN
    ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingItem_bookingId_fkey'
  ) THEN
    ALTER TABLE "BookingItem"
    ADD CONSTRAINT "BookingItem_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingItem_productId_fkey'
  ) THEN
    ALTER TABLE "BookingItem"
    ADD CONSTRAINT "BookingItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
