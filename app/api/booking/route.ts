import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";
import {
  bookingTimeOverlaps,
  minutesToTime,
  normalizeBusinessType,
  resolveOperationalBookingDurationMinutes,
  syncOverdueBookings,
  timeToMinutes,
} from "@/lib/booking";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncOverdueBookings(storeId, store.bookingGraceMinutes ?? 30);

  const where: {
    storeId: string;
    status?: string;
    bookingDate?: Date;
  } = { storeId };

  if (status) where.status = status;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.bookingDate = new Date(`${date}T00:00:00.000+07:00`);
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    include: {
      resource: true,
      items: {
        select: {
          id: true,
          productId: true,
          name: true,
          itemType: true,
          qty: true,
          unitPrice: true,
          durationMin: true,
        },
      },
    },
  });

  return NextResponse.json(bookings);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const {
    storeId,
    customerName,
    customerPhone,
    bookingDate,
    startTime,
    resourceId,
    pax,
    customerNote,
    items,
  } = body as {
    storeId?: string;
    customerName?: string;
    customerPhone?: string;
    bookingDate?: string;
    startTime?: string;
    resourceId?: string;
    pax?: number | null;
    customerNote?: string | null;
    items?: Array<{
      productId?: string | null;
      name?: string;
      itemType?: string;
      qty?: number;
      unitPrice?: number;
      durationMin?: number | null;
    }>;
  };

  if (!storeId || !customerName || !bookingDate || !startTime || !resourceId) {
    return NextResponse.json(
      { error: "storeId, customerName, bookingDate, startTime, dan resourceId wajib diisi" },
      { status: 400 }
    );
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncOverdueBookings(storeId, store.bookingGraceMinutes ?? 30);

  const resource = await prisma.bookingResource.findFirst({
    where: {
      id: resourceId,
      storeId,
      isActive: true,
    },
  });

  if (!resource) {
    return NextResponse.json({ error: "Resource tidak tersedia" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !/^\d{2}:\d{2}$/.test(startTime)) {
    return NextResponse.json({ error: "Format tanggal atau jam tidak valid" }, { status: 400 });
  }

  const targetDate = new Date(`${bookingDate}T00:00:00.000+07:00`);
  const businessType = normalizeBusinessType(store.type);
  const normalizedItems = Array.isArray(items) ? items.filter((item) => item?.name?.trim()) : [];
  const durationMinutes = resolveOperationalBookingDurationMinutes(
    businessType,
    store.bookingSlotMinutes ?? 30,
    normalizedItems
  );

  if (businessType === "CAFE" && resource.capacity && typeof pax === "number" && pax > resource.capacity) {
    return NextResponse.json({ error: "Kapasitas resource lebih kecil dari jumlah pax" }, { status: 400 });
  }

  const sameDayBookings = await prisma.booking.findMany({
    where: {
      storeId,
      resourceId,
      bookingDate: targetDate,
      status: {
        in: ["PENDING", "CONFIRMED", "ARRIVED"],
      },
    },
    select: {
      startTime: true,
      type: true,
      items: {
        select: {
          durationMin: true,
        },
      },
    },
  });

  const overlappingBooking = sameDayBookings.find((booking) =>
    bookingTimeOverlaps(
      startTime,
      durationMinutes,
      booking.startTime,
      resolveOperationalBookingDurationMinutes(
        booking.type as "BARBER" | "CAFE",
        store.bookingSlotMinutes ?? 30,
        booking.items
      )
    )
  );

  if (overlappingBooking) {
    return NextResponse.json({ error: "Slot ini sudah terpakai" }, { status: 409 });
  }

  const booking = await prisma.booking.create({
    data: {
      storeId,
      resourceId,
      type: businessType,
      source: "OFFLINE",
      status: "ARRIVED",
      customerName: customerName.trim(),
      customerPhone: customerPhone?.replace(/\D/g, "") || "OFFLINE",
      customerNote: customerNote?.trim() || null,
      bookingDate: targetDate,
      startTime,
      endTime: minutesToTime(timeToMinutes(startTime) + durationMinutes),
      pax: businessType === "CAFE" && typeof pax === "number" && pax > 0 ? pax : null,
      areaLabel: businessType === "CAFE" ? resource.name : null,
      barberName: businessType === "BARBER" ? resource.name : null,
      dpAmount: 0,
      dpStatus: "WAIVED",
      checkInAt: new Date(),
      items: normalizedItems.length
        ? {
            create: normalizedItems.map((item) => ({
              productId: typeof item.productId === "string" && item.productId.trim() ? item.productId.trim() : null,
              name: item.name?.trim() || "Walk-in",
              itemType: item.itemType?.trim() || "PRODUCT",
              qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1,
              unitPrice: typeof item.unitPrice === "number" && item.unitPrice > 0 ? Math.round(item.unitPrice) : 0,
              durationMin: typeof item.durationMin === "number" && item.durationMin > 0 ? item.durationMin : null,
            })),
          }
        : undefined,
    },
    include: {
      resource: true,
      items: true,
    },
  });

  return NextResponse.json(booking, { status: 201 });
}
