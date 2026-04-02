import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET semua produk by storeId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json(
      { error: "storeId wajib diisi" },
      { status: 400 }
    );
  }

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

// POST tambah produk baru
export async function POST(req: Request) {
  const body = await req.json();
  const { name, price, stock, storeId } = body;

  if (!name || !price || !storeId) {
    return NextResponse.json(
      { error: "name, price, storeId wajib diisi" },
      { status: 400 }
    );
  }

  const product = await prisma.product.create({
    data: {
      name,
      price,
      stock: stock ?? 0,
      storeId,
    },
  });

  return NextResponse.json(product, { status: 201 });
}