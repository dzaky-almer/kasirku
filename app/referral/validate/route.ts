// ============================================================
// LOKASI: app/api/referral/validate/route.ts
// BUAT FOLDER BARU: app/api/referral/validate/
// Lalu taruh file ini di dalamnya
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ valid: false, error: "Kode tidak boleh kosong" });
  }

  try {
    const record = await prisma.referralCode.findUnique({
      where: { code },
    });

    if (!record) {
      return NextResponse.json({ valid: false, error: "Kode tidak ditemukan" });
    }

    if (record.isUsed || !record.isActive) {
      return NextResponse.json({ valid: false, error: "Kode sudah digunakan atau tidak aktif" });
    }

    if (record.expiresAt && new Date() > record.expiresAt) {
      return NextResponse.json({ valid: false, error: "Kode sudah kedaluwarsa" });
    }

    const planLabel: Record<string, string> = {
      starter: "Starter",
      pro: "Pro",
      ultra: "Ultra",
    };

    return NextResponse.json({
      valid: true,
      plan: record.plan,
      tier: record.tier,
      durationDays: record.durationDays,
      planLabel: planLabel[record.plan] ?? record.plan,
      tierLabel: record.tier === "yearly" ? "Tahunan" : "Bulanan",
      message: `✓ Kode valid — Paket ${planLabel[record.plan] ?? record.plan} ${record.tier === "yearly" ? "Tahunan" : "Bulanan"} (${record.durationDays} hari)`,
    });
  } catch (err) {
    console.error("Validate referral error:", err);
    return NextResponse.json(
      { valid: false, error: "Gagal mengecek kode. Coba lagi." },
      { status: 500 }
    );
  }
}