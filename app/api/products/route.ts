import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";
import { createStockMovement } from "@/lib/inventory";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    where: { storeId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json();
  const {
    name,
    price,
    stock,
    storeId,
    barcode,
    sku,
    costPrice,
    minStock,
    unit,
    category,
    imageUrl,
    label,
    supplierId,
    bookingEnabled,
    bookingDurationMin,
  } = body;

  if (!name || !price || !storeId) {
    return NextResponse.json(
      { error: "name, price, storeId wajib diisi" },
      { status: 400 }
    );
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const product = await prisma.$transaction(async (tx) => {
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, storeId },
        select: { id: true },
      });

      if (!supplier) {
        throw new Error("Supplier tidak ditemukan");
      }
    }

    const created = await tx.product.create({
      data: {
        name,
        price,
        stock: 0,
        storeId,
        barcode: barcode || null,
        sku: sku || null,
        costPrice: costPrice || null,
        minStock: minStock ?? 5,
        unit: unit || "pcs",
        category: category || null,
        imageUrl: imageUrl || null,
        label: label || null,
        supplierId: supplierId || null,
        bookingEnabled: Boolean(bookingEnabled),
        bookingDurationMin:
          typeof bookingDurationMin === "number" && bookingDurationMin > 0 ? bookingDurationMin : null,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const initialStock = Number(stock ?? 0);
    if (initialStock > 0) {
      await createStockMovement(tx, {
        storeId,
        productId: created.id,
        type: "IN",
        reason: "INITIAL_STOCK",
        qtyChange: initialStock,
        supplierId: supplierId || null,
        createdById: userId ?? null,
        note: "Stok awal saat membuat produk",
      });
      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    return created;
  });

  return NextResponse.json(product, { status: 201 });
}
