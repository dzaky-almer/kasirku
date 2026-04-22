import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";
import { syncOverdueBookings } from "@/lib/booking";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date");

  if (!storeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "storeId dan date wajib valid" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncOverdueBookings(storeId, store.bookingGraceMinutes ?? 30);

  const bookingDate = new Date(`${date}T00:00:00.000+07:00`);
  const resources = await prisma.bookingResource.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const bookings = await prisma.booking.findMany({
    where: {
      storeId,
      bookingDate,
    },
    orderBy: [{ startTime: "asc" }],
    include: {
      items: {
        select: {
          id: true,
          qty: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    date,
    resources,
    bookings,
  });
}
