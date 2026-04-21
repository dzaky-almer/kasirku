import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId as string | undefined;

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId wajib diisi" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      storeId: store.id,
    },
    select: {
      id: true,
      dpAmount: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      dpStatus: booking.dpAmount > 0 ? "PAID" : "WAIVED",
      dpPaidAt: booking.dpAmount > 0 ? new Date() : null,
      paymentStatusRaw: booking.dpAmount > 0 ? "settlement" : "manual",
    },
    include: {
      items: true,
      resource: true,
    },
  });

  return NextResponse.json({ success: true, booking: updated });
}
