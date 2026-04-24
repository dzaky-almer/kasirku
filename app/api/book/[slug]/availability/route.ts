import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  bookingTimeOverlaps,
  generateBookingSlots,
  normalizeBusinessType,
  resolveOperationalBookingDurationMinutes,
  syncOverdueBookings,
} from "@/lib/booking";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const bookingDate = searchParams.get("date");
    const resourceId = searchParams.get("resourceId");
    const pax = Number(searchParams.get("pax") || 0);
    const durationMinutes = Number(searchParams.get("durationMinutes") || 0);

    if (!bookingDate || !resourceId || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return NextResponse.json({ error: "date dan resourceId wajib valid" }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      select: {
        id: true,
        type: true,
        bookingGraceMinutes: true,
        bookingOpenTime: true,
        bookingCloseTime: true,
        bookingSlotMinutes: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
    }

    await syncOverdueBookings(store.id, store.bookingGraceMinutes ?? 30);

    const resource = await prisma.bookingResource.findFirst({
      where: {
        id: resourceId,
        storeId: store.id,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        capacity: true,
      },
    });

    if (!resource) {
      return NextResponse.json({ error: "Resource tidak tersedia" }, { status: 404 });
    }

    const businessType = normalizeBusinessType(store.type);
    if (businessType === "CAFE" && resource.capacity && pax > 0 && pax > resource.capacity) {
      return NextResponse.json({ error: "Kapasitas resource tidak cukup untuk pax ini" }, { status: 400 });
    }

    const targetDate = new Date(`${bookingDate}T00:00:00.000+07:00`);
    const bookings = await prisma.booking.findMany({
      where: {
        storeId: store.id,
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

    const requestDuration = resolveOperationalBookingDurationMinutes(
      businessType,
      store.bookingSlotMinutes,
      durationMinutes > 0 ? [{ durationMin: durationMinutes }] : undefined
    );
    const now = new Date();
    const slots = generateBookingSlots(
      store.bookingOpenTime,
      store.bookingCloseTime,
      store.bookingSlotMinutes
    ).map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const slotDate = new Date(targetDate);
      slotDate.setHours(hours, minutes, 0, 0);

      const isPast = isSameDay(targetDate, now) && slotDate <= now;
      const isTaken = bookings.some((booking) =>
        bookingTimeOverlaps(
          time,
          requestDuration,
          booking.startTime,
          resolveOperationalBookingDurationMinutes(
            booking.type as "BARBER" | "CAFE",
            store.bookingSlotMinutes,
            booking.items
          )
        )
      );

      return {
        time,
        available: !isPast && !isTaken,
        reason: isPast ? "Jam sudah lewat" : isTaken ? "Sudah dibooking" : null,
      };
    });

    return NextResponse.json({
      resourceId,
      slots,
      slotMinutes: store.bookingSlotMinutes,
      openTime: store.bookingOpenTime,
      closeTime: store.bookingCloseTime,
    });
  } catch (error) {
    console.error("Public booking availability GET error:", error);
    return NextResponse.json({ error: "Gagal memuat slot booking" }, { status: 500 });
  }
}
