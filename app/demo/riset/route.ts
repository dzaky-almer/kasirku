

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Durasi demo dalam jam (bisa diatur dari .env)
// Default: 1 jam. Untuk testing ganti ke 0.1 (6 menit)
function getDemoDurationHours(): number {
  const val = parseFloat(process.env.DEMO_DURATION_HOURS ?? "1");
  return isNaN(val) || val <= 0 ? 1 : val;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const { sessionKey } = body;

  const demoStoreId = process.env.DEMO_STORE_ID;
  if (!demoStoreId) {
    return NextResponse.json(
      { error: "Demo belum dikonfigurasi. Hubungi admin." },
      { status: 500 }
    );
  }

  // ── Reset data demo ─────────────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      // Hapus transaction items dulu (foreign key)
      await tx.transactionItem.deleteMany({
        where: { transaction: { storeId: demoStoreId } },
      });

      // Hapus transaksi
      await tx.transaction.deleteMany({
        where: { storeId: demoStoreId },
      });

      // Hapus shift yang masih open
      await tx.shift.deleteMany({
        where: { storeId: demoStoreId },
      });

      // Reset stok semua produk demo ke 50
      await tx.product.updateMany({
        where: { storeId: demoStoreId },
        data: { stock: 50 },
      });
    });

    // ── Buat/update sesi demo ──────────────────────────────────
    const hours = getDemoDurationHours();
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    let newSessionKey = sessionKey;

    if (sessionKey) {
      // Update sesi yang ada
      await prisma.demoSession.upsert({
        where: { sessionKey },
        update: {
          startedAt: new Date(),
          expiresAt,
          resetCount: { increment: 1 },
        },
        create: {
          sessionKey,
          storeId: demoStoreId,
          startedAt: new Date(),
          expiresAt,
        },
      });
    } else {
      // Buat sesi baru
      newSessionKey = crypto.randomUUID();
      await prisma.demoSession.create({
        data: {
          sessionKey: newSessionKey,
          storeId: demoStoreId,
          startedAt: new Date(),
          expiresAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      sessionKey: newSessionKey,
      expiresAt: expiresAt.toISOString(),
      durationHours: hours,
      message: "Demo berhasil direset",
    });
  } catch (err) {
    console.error("Demo reset error:", err);
    return NextResponse.json({ error: "Gagal reset demo" }, { status: 500 });
  }
}

// GET: cek apakah sesi demo masih aktif
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("sessionKey");

  const demoStoreId = process.env.DEMO_STORE_ID;

  if (!sessionKey) {
    // Tidak ada sessionKey → buat sesi baru
    const hours = getDemoDurationHours();
    const newKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await prisma.demoSession.create({
      data: {
        sessionKey: newKey,
        storeId: demoStoreId ?? "",
        startedAt: new Date(),
        expiresAt,
      },
    });

    return NextResponse.json({
      active: true,
      sessionKey: newKey,
      expiresAt: expiresAt.toISOString(),
      storeId: demoStoreId,
      isNew: true,
    });
  }

  const session = await prisma.demoSession.findUnique({
    where: { sessionKey },
  });

  if (!session) {
    return NextResponse.json({ active: false, error: "Sesi tidak ditemukan" });
  }

  const isExpired = new Date() > session.expiresAt;
  const remainingMs = Math.max(0, session.expiresAt.getTime() - Date.now());

  return NextResponse.json({
    active: !isExpired,
    sessionKey,
    expiresAt: session.expiresAt.toISOString(),
    remainingMs,
    remainingMinutes: Math.ceil(remainingMs / 60000),
    storeId: session.storeId,
    resetCount: session.resetCount,
  });
}