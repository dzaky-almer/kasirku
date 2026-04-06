import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
  });

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, price, stock, barcode, sku, costPrice, minStock, unit, category, imageUrl } = body;

  const product = await prisma.product.update({
    where: { id: params.id },
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
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Hapus transaction items dulu sebelum hapus produk
    await prisma.transactionItem.deleteMany({
      where: { productId: params.id },
    });

    await prisma.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Produk berhasil dihapus" });
  } catch (error) {
    return NextResponse.json(
      { error: "Gagal menghapus produk" },
      { status: 500 }
    );
  }
}