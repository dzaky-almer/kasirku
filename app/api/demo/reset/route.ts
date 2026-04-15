import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getDemoDurationHours(): number {
  const value = parseFloat(process.env.DEMO_DURATION_HOURS ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

async function getDemoStore() {
  const demoStoreId = process.env.DEMO_STORE_ID;

  if (!demoStoreId) {
    throw new Error("DEMO_STORE_ID belum dikonfigurasi");
  }

  const store = await prisma.store.findUnique({
    where: { id: demoStoreId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!store) {
    throw new Error("Store demo tidak ditemukan");
  }

  return store;
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

    await tx.product.updateMany({
      where: { storeId },
      data: { stock: 50 },
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
    return NextResponse.json({ error: "Gagal reset demo" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("sessionKey");

  if (!sessionKey) {
    return NextResponse.json({ active: false, error: "sessionKey wajib diisi" }, { status: 400 });
  }

  try {
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

    return NextResponse.json(
      buildSessionPayload(session.sessionKey, session.store.id, session.store.userId, session.expiresAt)
    );
  } catch (error) {
    console.error("Demo session error:", error);
    return NextResponse.json({ active: false, error: "Gagal cek sesi demo" }, { status: 500 });
  }
}
