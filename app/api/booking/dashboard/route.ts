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

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncOverdueBookings(storeId, store.bookingGraceMinutes ?? 30);

  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00.000+07:00`)
    : new Date(new Date().toLocaleDateString("en-CA"));
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      storeId,
      bookingDate: {
        gte: targetDate,
        lt: nextDate,
      },
    },
    select: {
      id: true,
      source: true,
      status: true,
      dpAmount: true,
      dpStatus: true,
    },
  });

  const totalDeposit = bookings
    .filter((booking) => booking.dpStatus === "PAID")
    .reduce((sum, booking) => sum + booking.dpAmount, 0);

  return NextResponse.json({
    date: targetDate.toISOString(),
    totalDeposit,
    activeBookings: bookings.filter((booking) => ["PENDING", "CONFIRMED", "ARRIVED"].includes(booking.status)).length,
    onlineBookings: bookings.filter((booking) => booking.source === "ONLINE").length,
    offlineBookings: bookings.filter((booking) => booking.source === "OFFLINE").length,
    paidDepositCount: bookings.filter((booking) => booking.dpStatus === "PAID").length,
    systemStatus: "SYNCED",
  });
}
