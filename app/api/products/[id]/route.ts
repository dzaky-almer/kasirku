import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET produk by id
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
  });

  if (!product) {
    return NextResponse.json(
      { error: "Produk tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json(product);
}

// PUT update produk
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, price, stock } = body;

  const product = await prisma.product.update({
    where: { id: params.id },
    data: { name, price, stock },
  });

  return NextResponse.json(product);
}

// DELETE produk
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.product.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ message: "Produk berhasil dihapus" });
}