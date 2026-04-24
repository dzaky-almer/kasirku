import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { prisma } from "@/lib/prisma";
import { generateUniqueStoreSlug } from "@/lib/slug";
import { canAccessStore } from "@/lib/store-access";

const bookingSettingsSelect = {
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
} as const;

const getHandler = async (req: Request) => {
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

  const existingStore = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, slug: true },
  });

  if (!existingStore) {
    return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
  }

  if (!existingStore.slug) {
    const generatedSlug = await generateUniqueStoreSlug(existingStore.name);
    await prisma.store.update({
      where: { id: storeId },
      data: { slug: generatedSlug },
    });
  }

  const settings = await prisma.store.findUnique({
    where: { id: storeId },
    select: bookingSettingsSelect,
  });

  if (!settings) {
    return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(settings);
};

const patchHandler = async (req: Request) => {
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
    select: bookingSettingsSelect,
  });

  return NextResponse.json(updated);
};

export const GET = withPlanGuard("booking")(getHandler);
export const PATCH = withPlanGuard("booking")(patchHandler);
