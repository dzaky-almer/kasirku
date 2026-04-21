import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getAuthorizedBooking(id: string, userId?: string | null) {
  if (!userId) return null;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      store: {
        select: {
          id: true,
          userId: true,
        },
      },
      resource: true,
      items: true,
    },
  });

  if (!booking || booking.store.userId !== userId) return null;
  return booking;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const booking = await getAuthorizedBooking(id, userId);
  if (!booking) {
    return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const booking = await getAuthorizedBooking(id, userId);
  if (!booking) {
    return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  }

  const { status, dpStatus } = body as {
    status?: string;
    dpStatus?: string;
  };

  const now = new Date();
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: typeof status === "string" ? status : undefined,
      dpStatus: typeof dpStatus === "string" ? dpStatus : undefined,
      dpPaidAt: dpStatus === "PAID" ? now : undefined,
      checkInAt: status === "ARRIVED" ? now : undefined,
      completedAt: status === "COMPLETED" ? now : undefined,
      noShowAt: status === "NO_SHOW" ? now : undefined,
    },
    include: {
      resource: true,
      items: true,
    },
  });

  return NextResponse.json(updated);
}
