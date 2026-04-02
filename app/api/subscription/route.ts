import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Cek status subscription user
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId wajib diisi" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "Subscription tidak ditemukan" },
      { status: 404 }
    );
  }

  const isExpired = new Date() > new Date(subscription.expiredAt);

  return NextResponse.json({
    ...subscription,
    isExpired,
    isActive: !isExpired,
  });
}

// POST - Buat subscription baru
export async function POST(req: Request) {
  const body = await req.json();
  const { userId, plan } = body;

  if (!userId || !plan) {
    return NextResponse.json(
      { error: "userId dan plan wajib diisi" },
      { status: 400 }
    );
  }

  const startDate = new Date();
  const expiredAt = new Date();

  // Hitung expired berdasarkan plan
  if (plan === "monthly") {
    expiredAt.setMonth(expiredAt.getMonth() + 1);
  } else if (plan === "yearly") {
    expiredAt.setFullYear(expiredAt.getFullYear() + 1);
  } else {
    return NextResponse.json(
      { error: "Plan harus 'monthly' atau 'yearly'" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      startDate,
      expiredAt,
      status: "active",
    },
    create: {
      userId,
      plan,
      startDate,
      expiredAt,
      status: "active",
    },
  });

  return NextResponse.json(subscription, { status: 201 });
}