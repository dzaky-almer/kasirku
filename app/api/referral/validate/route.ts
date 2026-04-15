import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  ultra: "Ultra",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ valid: false, error: "Kode referral wajib diisi" }, { status: 400 });
  }

  try {
    const record = await prisma.referralCode.findUnique({
      where: { code },
    });

    if (!record) {
      return NextResponse.json({ valid: false, error: "Kode tidak ditemukan" });
    }

    if (!record.isActive || record.isUsed) {
      return NextResponse.json({ valid: false, error: "Kode sudah dipakai atau tidak aktif" });
    }

    if (record.expiresAt && new Date() > record.expiresAt) {
      return NextResponse.json({ valid: false, error: "Kode referral sudah kedaluwarsa" });
    }

    const planLabel = PLAN_LABEL[record.plan] ?? record.plan;
    const tierLabel = record.tier === "yearly" ? "Tahunan" : "Bulanan";

    return NextResponse.json({
      valid: true,
      plan: record.plan,
      tier: record.tier,
      durationDays: record.durationDays,
      planLabel,
      tierLabel,
      message: `Paket ${planLabel} ${tierLabel} aktif ${record.durationDays} hari`,
    });
  } catch (error) {
    console.error("Referral validate error:", error);
    return NextResponse.json({ valid: false, error: "Gagal mengecek kode referral" }, { status: 500 });
  }
}
