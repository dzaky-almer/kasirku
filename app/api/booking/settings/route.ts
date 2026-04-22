import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      bookingGraceMinutes: true,
      bookingOpenTime: true,
      bookingCloseTime: true,
      bookingSlotMinutes: true,
      bookingResources: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          type: true,
          name: true,
          capacity: true,
          description: true,
          isActive: true,
        },
      },
      products: {
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          bookingEnabled: true,
          bookingDurationMin: true,
        },
      },
    },
  });

  if (!settings) {
    return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const {
    storeId,
    bookingGraceMinutes,
    bookingOpenTime,
    bookingCloseTime,
    bookingSlotMinutes,
  } = body as {
    storeId?: string;
    bookingGraceMinutes?: number;
    bookingOpenTime?: string;
    bookingCloseTime?: string;
    bookingSlotMinutes?: number;
  };

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      bookingGraceMinutes:
        typeof bookingGraceMinutes === "number" ? Math.min(Math.max(bookingGraceMinutes, 0), 240) : undefined,
      bookingOpenTime: typeof bookingOpenTime === "string" ? bookingOpenTime : undefined,
      bookingCloseTime: typeof bookingCloseTime === "string" ? bookingCloseTime : undefined,
      bookingSlotMinutes:
        typeof bookingSlotMinutes === "number" ? Math.min(Math.max(bookingSlotMinutes, 5), 180) : undefined,
    },
    select: {
      id: true,
      bookingGraceMinutes: true,
      bookingOpenTime: true,
      bookingCloseTime: true,
      bookingSlotMinutes: true,
    },
  });

  return NextResponse.json(updated);
}
