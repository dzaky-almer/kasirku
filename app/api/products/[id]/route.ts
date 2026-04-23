import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";
import { createStockMovement } from "@/lib/inventory";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(product.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const body = await req.json();
  const {
    name,
    price,
    stock,
    barcode,
    sku,
    costPrice,
    minStock,
    unit,
    category,
    imageUrl,
    supplierId,
    bookingEnabled,
    bookingDurationMin,
  } = body;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      stock: true,
      storeId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(existing.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const product = await prisma.$transaction(async (tx) => {
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, storeId: existing.storeId },
        select: { id: true },
      });

      if (!supplier) {
        throw new Error("Supplier tidak ditemukan");
      }
    }

    const updated = await tx.product.update({
      where: { id },
      data: {
        name,
        price,
        stock: existing.stock,
        barcode: barcode || null,
        sku: sku || null,
        costPrice: costPrice || null,
        minStock: minStock ?? 5,
        unit: unit || "pcs",
        category: category || null,
        imageUrl: imageUrl || null,
        supplierId: supplierId || null,
        label: body.label || null,
        bookingEnabled: typeof bookingEnabled === "boolean" ? bookingEnabled : undefined,
        bookingDurationMin:
          typeof bookingDurationMin === "number" && bookingDurationMin > 0
            ? bookingDurationMin
            : bookingDurationMin === null
              ? null
              : undefined,
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

    if (typeof stock === "number" && stock !== existing.stock) {
      await createStockMovement(tx, {
        storeId: existing.storeId,
        productId: id,
        type: "ADJUSTMENT",
        reason: "MANUAL_EDIT",
        qtyChange: stock - existing.stock,
        supplierId: supplierId || null,
        createdById: userId ?? null,
        note: "Penyesuaian stok dari edit produk",
      });

      return tx.product.findUniqueOrThrow({
        where: { id },
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

    return updated;
  });

  return NextResponse.json(product);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      storeId: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(product.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.transactionItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Produk berhasil dihapus" });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}
