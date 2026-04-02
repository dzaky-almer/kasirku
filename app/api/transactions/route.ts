import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSubscription, subscriptionExpiredResponse } from "@/app/api/middleware";

// POST - Simpan transaksi baru
export async function POST(req: Request) {
  const body = await req.json();
  const { storeId, userId, items } = body;

  if (!storeId || !userId || !items || items.length === 0) {
    return NextResponse.json(
      { error: "storeId, userId, dan items wajib diisi" },
      { status: 400 }
    );
  }

  // Cek subscription sebelum transaksi
  const subCheck = await checkSubscription(userId);
  if (!subCheck.allowed) {
    return subscriptionExpiredResponse();
  }

  // Hitung total
  const total = items.reduce(
    (sum: number, item: { price: number; qty: number }) =>
      sum + item.price * item.qty,
    0
  );

  // Simpan transaksi + items sekaligus
  const transaction = await prisma.transaction.create({
    data: {
      storeId,
      total,
      items: {
        create: items.map((item: {
          productId: string;
          qty: number;
          price: number;
        }) => ({
          productId: item.productId,
          qty: item.qty,
          price: item.price,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  // Kurangi stok produk
  for (const item of items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        stock: {
          decrement: item.qty,
        },
      },
    });
  }

  return NextResponse.json(transaction, { status: 201 });
}

// GET - Ambil transaksi by storeId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json(
      { error: "storeId wajib diisi" },
      { status: 400 }
    );
  }

  const transactions = await prisma.transaction.findMany({
    where: { storeId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}

