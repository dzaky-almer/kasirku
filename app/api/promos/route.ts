// app/api/promos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// GET /api/promos?storeId=xxx
// GET /api/promos?storeId=xxx&all=true  ← admin mode
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const all = searchParams.get("all") === "true";

  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  const now = new Date();

  const promos = await prisma.promo.findMany({
    where: {
      storeId,
      ...(!all && {
        isActive: true,
        // filter maxUsage ditangani client-side di bawah
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      }),
    },
    include: {
      rules: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { priority: "asc" },
  });

  // Filter client-side: hapus promo yang sudah habis kuota
  const result = all
    ? promos
    : promos.filter((p) => p.maxUsage === null || p.usageCount < p.maxUsage);

  return NextResponse.json(result);
}

// ─────────────────────────────────────────────────────────
// POST /api/promos  — buat promo baru (dengan multi rules)
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    storeId,
    name,
    tag,
    priority,
    stackable,
    maxUsage,
    startDate,
    endDate,
    rules, // PromoRule[]
  } = body;

  if (!storeId || !name || !Array.isArray(rules) || rules.length === 0) {
    return NextResponse.json(
      { error: "storeId, name, dan minimal 1 rule wajib diisi" },
      { status: 400 }
    );
  }

  // Validasi tiap rule
  for (const rule of rules) {
    if (!rule.type || !rule.discountType || !rule.discountValue) {
      return NextResponse.json(
        { error: "Setiap rule wajib punya type, discountType, dan discountValue" },
        { status: 400 }
      );
    }
  }

  const promo = await prisma.promo.create({
    data: {
      storeId,
      name,
      tag: tag || null,
      priority: priority ? Number(priority) : 1,
      stackable: stackable ?? false,
      maxUsage: maxUsage ? Number(maxUsage) : null,
      usageCount: 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      // Buat semua rules sekaligus
      rules: {
        create: rules.map((r: any, idx: number) => ({
          type: r.type,
          discountType: r.discountType,
          discountValue: Number(r.discountValue),
          productId: r.type === "PRODUCT" && r.productId ? r.productId : null,
          startTime: r.type === "HAPPY_HOUR" ? r.startTime : null,
          endTime: r.type === "HAPPY_HOUR" ? r.endTime : null,
          minTransaction:
            r.type === "MIN_TRANSACTION" && r.minTransaction
              ? Number(r.minTransaction)
              : null,
          order: idx, // urutan rule dalam promo
        })),
      },
    },
    include: {
      rules: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json(promo, { status: 201 });
}

// ─────────────────────────────────────────────────────────
// PATCH /api/promos  — update promo + rules (upsert)
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, rules, ...data } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Kalau tidak ada rules → update field biasa saja (misal toggle isActive)
  if (!rules) {
    const promo = await prisma.promo.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        priority: data.priority ? Number(data.priority) : undefined,
        maxUsage: data.maxUsage !== undefined
          ? data.maxUsage ? Number(data.maxUsage) : null
          : undefined,
      },
      include: {
        rules: {
          include: { product: { select: { id: true, name: true } } },
          orderBy: { order: "asc" },
        },
      },
    });
    return NextResponse.json(promo);
  }

  // Kalau ada rules → hapus rules lama, buat ulang (simplest & safest approach)
  const promo = await prisma.$transaction(async (tx) => {
    // 1. Hapus rules lama
    await tx.promoRule.deleteMany({ where: { promoId: id } });

    // 2. Update promo + buat rules baru
    return tx.promo.update({
      where: { id },
      data: {
        name: data.name,
        tag: data.tag ?? null,
        priority: data.priority ? Number(data.priority) : undefined,
        stackable: data.stackable ?? undefined,
        maxUsage: data.maxUsage !== undefined
          ? data.maxUsage ? Number(data.maxUsage) : null
          : undefined,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        rules: {
          create: rules.map((r: any, idx: number) => ({
            type: r.type,
            discountType: r.discountType,
            discountValue: Number(r.discountValue),
            productId: r.type === "PRODUCT" && r.productId ? r.productId : null,
            startTime: r.type === "HAPPY_HOUR" ? r.startTime : null,
            endTime: r.type === "HAPPY_HOUR" ? r.endTime : null,
            minTransaction:
              r.type === "MIN_TRANSACTION" && r.minTransaction
                ? Number(r.minTransaction)
                : null,
            order: idx,
          })),
        },
      },
      include: {
        rules: {
          include: { product: { select: { id: true, name: true } } },
          orderBy: { order: "asc" },
        },
      },
    });
  });

  return NextResponse.json(promo);
}

// ─────────────────────────────────────────────────────────
// DELETE /api/promos?id=xxx
// ─────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Rules terhapus otomatis kalau pakai onDelete: Cascade di schema
  await prisma.promo.delete({ where: { id } });

  return NextResponse.json({ success: true });
}