import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_PRODUCTS = [
  { name: "Espresso", price: 18000, costPrice: 8000, stock: 80, minStock: 10, unit: "cup", category: "Kopi", label: "Best Seller" },
  { name: "Americano", price: 22000, costPrice: 9000, stock: 75, minStock: 10, unit: "cup", category: "Kopi" },
  { name: "Cappuccino", price: 28000, costPrice: 12000, stock: 70, minStock: 10, unit: "cup", category: "Kopi", label: "Promo" },
  { name: "Cafe Latte", price: 30000, costPrice: 13000, stock: 70, minStock: 10, unit: "cup", category: "Kopi" },
  { name: "Mocha", price: 32000, costPrice: 14000, stock: 65, minStock: 8, unit: "cup", category: "Kopi" },
  { name: "Kopi Susu Gula Aren", price: 26000, costPrice: 11000, stock: 90, minStock: 12, unit: "cup", category: "Kopi", label: "Best Seller" },
  { name: "Matcha Latte", price: 32000, costPrice: 15000, stock: 55, minStock: 8, unit: "cup", category: "Non-Kopi", label: "Baru" },
  { name: "Chocolate", price: 28000, costPrice: 12000, stock: 50, minStock: 8, unit: "cup", category: "Non-Kopi" },
  { name: "Lychee Tea", price: 24000, costPrice: 9000, stock: 60, minStock: 8, unit: "cup", category: "Minuman" },
  { name: "Croissant Butter", price: 18000, costPrice: 7000, stock: 35, minStock: 5, unit: "pcs", category: "Makanan" },
  { name: "Pain Au Chocolat", price: 22000, costPrice: 9000, stock: 30, minStock: 5, unit: "pcs", category: "Makanan" },
  { name: "Chicken Sandwich", price: 34000, costPrice: 17000, stock: 25, minStock: 4, unit: "pcs", category: "Makanan" },
];

function getDemoDurationHours(): number {
  const value = parseFloat(process.env.DEMO_DURATION_HOURS ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

async function getDemoStore() {
  const demoStoreId = process.env.DEMO_STORE_ID;
  const select = {
    id: true,
    userId: true,
  } as const;

  async function markAsDemo(storeId: string) {
    await prisma.store.update({
      where: { id: storeId },
      data: { isDemo: true },
    });
  }

  if (demoStoreId) {
    const store = await prisma.store.findUnique({
      where: { id: demoStoreId },
      select,
    });

    if (store) {
      await markAsDemo(store.id);
      return store;
    }
  }

  const fallbackStore = await prisma.store.findFirst({
    where: {
      OR: [
        { isDemo: true },
        { user: { email: "user1@kopi.com" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select,
  });

  if (fallbackStore) {
    await markAsDemo(fallbackStore.id);
    return fallbackStore;
  }

  throw new Error(
    demoStoreId
      ? "Store demo tidak ditemukan. Perbarui DEMO_STORE_ID atau tandai store demo dengan isDemo=true."
      : "DEMO_STORE_ID belum dikonfigurasi dan belum ada store dengan isDemo=true."
  );
}

function buildSessionPayload(sessionKey: string, storeId: string, userId: string, expiresAt: Date) {
  const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());

  return {
    active: remainingMs > 0,
    sessionKey,
    storeId,
    userId,
    expiresAt: expiresAt.toISOString(),
    remainingMs,
    remainingMinutes: Math.ceil(remainingMs / 60000),
    durationHours: getDemoDurationHours(),
  };
}

async function resetDemoData(storeId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.transactionItem.deleteMany({
      where: {
        transaction: {
          storeId,
        },
      },
    });

    await tx.transaction.deleteMany({
      where: { storeId },
    });

    await tx.shift.deleteMany({
      where: { storeId },
    });

    await tx.promoRule.deleteMany({
      where: {
        promo: {
          storeId,
        },
      },
    });

    await tx.promo.deleteMany({
      where: { storeId },
    });

    await tx.product.deleteMany({
      where: { storeId },
    });

    await tx.product.createMany({
      data: DEMO_PRODUCTS.map((product) => ({
        ...product,
        storeId,
      })),
    });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionKey } = body as { sessionKey?: string | null };
    const store = await getDemoStore();

    await resetDemoData(store.id);

    const expiresAt = new Date(Date.now() + getDemoDurationHours() * 60 * 60 * 1000);

    const activeSessionKey = sessionKey?.trim() || crypto.randomUUID();

    if (sessionKey) {
      await prisma.demoSession.upsert({
        where: { sessionKey: activeSessionKey },
        update: {
          storeId: store.id,
          startedAt: new Date(),
          expiresAt,
          resetCount: { increment: 1 },
        },
        create: {
          sessionKey: activeSessionKey,
          storeId: store.id,
          startedAt: new Date(),
          expiresAt,
        },
      });
    } else {
      await prisma.demoSession.create({
        data: {
          sessionKey: activeSessionKey,
          storeId: store.id,
          startedAt: new Date(),
          expiresAt,
        },
      });
    }

    return NextResponse.json(buildSessionPayload(activeSessionKey, store.id, store.userId, expiresAt));
  } catch (error) {
    console.error("Demo reset error:", error);
    const message = error instanceof Error ? error.message : "Gagal reset demo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("sessionKey");

  if (!sessionKey) {
    return NextResponse.json({ active: false, error: "sessionKey wajib diisi" }, { status: 400 });
  }

  try {
    const activeStore = await getDemoStore();
    const session = await prisma.demoSession.findUnique({
      where: { sessionKey },
      include: {
        store: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ active: false, error: "Sesi demo tidak ditemukan" }, { status: 404 });
    }

    if (session.store.id !== activeStore.id) {
      const updatedSession = await prisma.demoSession.update({
        where: { sessionKey },
        data: { storeId: activeStore.id },
        include: {
          store: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      return NextResponse.json(
        buildSessionPayload(
          updatedSession.sessionKey,
          updatedSession.store.id,
          updatedSession.store.userId,
          updatedSession.expiresAt
        )
      );
    }

    return NextResponse.json(
      buildSessionPayload(session.sessionKey, session.store.id, session.store.userId, session.expiresAt)
    );
  } catch (error) {
    console.error("Demo session error:", error);
    return NextResponse.json({ active: false, error: "Gagal cek sesi demo" }, { status: 500 });
  }
}
