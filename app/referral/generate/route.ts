// ============================================================
// LOKASI: app/api/referral/generate/route.ts
// BUAT FOLDER BARU: app/api/referral/generate/
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `TK-${seg(4)}-${seg(4)}`;
}

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { plan = "pro", tier = "monthly", quantity = 1, expiresInDays = 7 } = body;

  const validPlans = ["starter", "pro", "ultra"];
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
  }

  const durationDays = tier === "yearly" ? 365 : 30;
  const qty = Math.min(parseInt(quantity), 50);
  const expiresAt = new Date(Date.now() + parseInt(expiresInDays) * 86400000);

  const createdCodes: string[] = [];

  for (let i = 0; i < qty; i++) {
    let code = "";
    for (let a = 0; a < 10; a++) {
      code = generateCode();
      const exists = await prisma.referralCode.findUnique({ where: { code } });
      if (!exists) break;
    }

    await prisma.referralCode.create({
      data: { code, plan, tier, durationDays, expiresAt, isActive: true, isUsed: false },
    });
    createdCodes.push(code);
  }

  const planLabel: Record<string, string> = { starter: "Starter", pro: "Pro", ultra: "Ultra" };
  const tierLabel = tier === "yearly" ? "Tahunan" : "Bulanan";

  const waPesanTemplate = createdCodes.map(
    (c) =>
      `Halo! Ini kode aktivasi TokoKu kamu:\n\n*Kode:* ${c}\n*Paket:* ${planLabel[plan]} (${tierLabel})\n*Aktif:* ${durationDays} hari\n\nCara aktivasi:\n1. Buka /register\n2. Masukkan kode di atas\n3. Isi data toko\n4. Selesai! 🎉\n\nKode hanya bisa dipakai 1x.`
  );

  return NextResponse.json({
    success: true,
    codes: createdCodes,
    plan,
    tier,
    durationDays,
    waPesanTemplate: qty === 1 ? waPesanTemplate[0] : waPesanTemplate,
  });
}

export async function GET(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = await prisma.referralCode.findMany({
    where: { isUsed: false, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ codes, total: codes.length });
}