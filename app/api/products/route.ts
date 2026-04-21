import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
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
    bookingEnabled,
    bookingDurationMin,
  } = body;

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
      barcode: barcode || null,
      sku: sku || null,
      costPrice: costPrice || null,
      minStock: minStock ?? 5,
      unit: unit || "pcs",
      category: category || null,
      imageUrl: imageUrl || null,
      label: label || null,
      bookingEnabled: Boolean(bookingEnabled),
      bookingDurationMin:
        typeof bookingDurationMin === "number" && bookingDurationMin > 0 ? bookingDurationMin : null,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
