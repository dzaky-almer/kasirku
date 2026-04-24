import { NextResponse } from "next/server";
import {
  createReferralCode,
  findReferralCodeByCode,
  listUnusedReferralCodes,
} from "@/lib/referral-codes";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `TK-${part(4)}-${part(4)}`;
}

function getPlanLabel(plan: string) {
  const labels: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    ultra: "Ultra",
  };

  return labels[plan] ?? plan;
}

function getTierLabel(tier: string) {
  return tier === "yearly" ? "Tahunan" : "Bulanan";
}

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");

  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { plan = "pro", tier = "monthly", quantity = 1, expiresInDays = 7 } = body as {
    plan?: string;
    tier?: string;
    quantity?: number;
    expiresInDays?: number;
  };

  if (!["starter", "pro", "ultra"].includes(plan)) {
    return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
  }

  if (!["monthly", "yearly"].includes(tier)) {
    return NextResponse.json({ error: "Tier tidak valid" }, { status: 400 });
  }

  const qty = Math.min(Math.max(Number(quantity) || 1, 1), 50);
  const safeExpiresInDays = Math.max(Number(expiresInDays) || 7, 1);
  const durationDays = tier === "yearly" ? 365 : 30;
  const expiresAt = new Date(Date.now() + safeExpiresInDays * 24 * 60 * 60 * 1000);

  const codes: string[] = [];

  for (let index = 0; index < qty; index += 1) {
    let code = "";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      code = generateCode();
      const exists = await findReferralCodeByCode(code);
      if (!exists) break;
    }

    await createReferralCode({
      code,
      plan,
      tier,
      durationDays,
      expiresAt,
    });

    codes.push(code);
  }

  const waPesanTemplate = codes.map((code) => {
    const registrationUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

    return [
      "Halo, akun TokoKu kamu sudah siap diaktifkan.",
      "",
      `Kode referral: ${code}`,
      `Paket: ${getPlanLabel(plan)} (${getTierLabel(tier)})`,
      `Durasi aktif: ${durationDays} hari`,
      "",
      "Cara aktivasi:",
      "1. Buka halaman registrasi",
      "2. Masukkan kode referral di atas",
      "3. Lengkapi data toko dan akun",
      "4. Login dan mulai pakai TokoKu",
      "",
      `Link registrasi: ${registrationUrl}/register?ref=${code}`,
      "",
      "Kode ini hanya bisa dipakai 1x.",
    ].join("\n");
  });

  return NextResponse.json({
    success: true,
    codes,
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

  const codes = await listUnusedReferralCodes(100);

  return NextResponse.json({ codes, total: codes.length });
}
