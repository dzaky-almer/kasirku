import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    bookingEnabled,
    bookingDurationMin,
  } = body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      price,
      stock,
      barcode: barcode || null,
      sku: sku || null,
      costPrice: costPrice || null,
      minStock: minStock ?? 5,
      unit: unit || "pcs",
      category: category || null,
      imageUrl: imageUrl || null,
      label: body.label || null,
      bookingEnabled: typeof bookingEnabled === "boolean" ? bookingEnabled : undefined,
      bookingDurationMin:
        typeof bookingDurationMin === "number" && bookingDurationMin > 0
          ? bookingDurationMin
          : bookingDurationMin === null
            ? null
            : undefined,
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.transactionItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Produk berhasil dihapus" });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}
