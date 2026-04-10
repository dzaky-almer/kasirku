// app/api/promos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// GET /api/promos?storeId=xxx
// GET /api/promos?storeId=xxx&all=true  ← untuk halaman admin (semua termasuk nonaktif)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const all = searchParams.get("all") === "true"; // admin mode

  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  const now = new Date();

  const promos = await prisma.promo.findMany({
    where: {
      storeId,
      // Kalau bukan admin mode, hanya ambil yang aktif & dalam masa berlaku
      ...(!all && {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      }),
    },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(promos);
}

// POST /api/promos
// Buat promo baru
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    storeId,
    name,
    type,
    discountType,
    discountValue,
    productId,
    startTime,
    endTime,
    minTransaction,
    startDate,
    endDate,
  } = body;

  if (!storeId || !name || !type || !discountType || !discountValue) {
    return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
  }

  const promo = await prisma.promo.create({
    data: {
      storeId,
      name,
      type,
      discountType,
      discountValue: Number(discountValue),
      productId: productId || null,
      startTime: startTime || null,
      endTime: endTime || null,
      minTransaction: minTransaction ? Number(minTransaction) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  return NextResponse.json(promo, { status: 201 });
}

// PATCH /api/promos
// Update promo (aktif/nonaktif atau ubah data)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const promo = await prisma.promo.update({
    where: { id },
    data,
  });

  return NextResponse.json(promo);
}

// DELETE /api/promos?id=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.promo.delete({ where: { id } });

  return NextResponse.json({ success: true });
}