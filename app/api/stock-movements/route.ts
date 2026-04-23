import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";
import { createStockMovement, type StockMovementType } from "@/lib/inventory";

interface StockMovementBody {
  storeId?: string;
  productId?: string;
  type?: StockMovementType;
  reason?: string;
  quantity?: number;
  targetStock?: number;
  note?: string;
  supplierId?: string | null;
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const productId = searchParams.get("productId");
  const limit = Number(searchParams.get("limit") ?? "20");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      storeId,
      ...(productId ? { productId } : {}),
    },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
  });

  return NextResponse.json(movements);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = (await req.json().catch(() => null)) as StockMovementBody | null;

  const storeId = body?.storeId?.trim();
  const productId = body?.productId?.trim();
  const reason = body?.reason?.trim();
  const movementType = body?.type;

  if (!storeId || !productId || !movementType || !reason) {
    return NextResponse.json(
      { error: "storeId, productId, type, dan reason wajib diisi" },
      { status: 400 }
    );
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (body.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: body.supplierId, storeId },
        select: { id: true },
      });

      if (!supplier) {
        throw new Error("Supplier tidak ditemukan");
      }
    }

    if (movementType === "ADJUSTMENT") {
      if (typeof body.targetStock !== "number" || body.targetStock < 0) {
        throw new Error("targetStock wajib diisi untuk adjustment");
      }

      const product = await tx.product.findFirst({
        where: { id: productId, storeId },
        select: { stock: true },
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      const qtyChange = body.targetStock - product.stock;

      return createStockMovement(tx, {
        storeId,
        productId,
        type: "ADJUSTMENT",
        reason,
        qtyChange,
        note: body.note,
        supplierId: body.supplierId ?? null,
        createdById: userId ?? null,
      });
    }

    if (typeof body.quantity !== "number" || body.quantity <= 0) {
      throw new Error("quantity wajib lebih dari 0");
    }

    const quantity = body.quantity;

    return createStockMovement(tx, {
      storeId,
      productId,
      type: movementType,
      reason,
      qtyChange: movementType === "OUT" ? -quantity : quantity,
      note: body.note,
      supplierId: body.supplierId ?? null,
      createdById: userId ?? null,
    });
  });

  return NextResponse.json(result, { status: 201 });
}
