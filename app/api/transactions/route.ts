import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { storeId, userId, items, paymentMethod } = body;

  if (!storeId || !userId || !items || items.length === 0) {
    return NextResponse.json(
      { error: "storeId, userId, dan items wajib diisi" },
      { status: 400 }
    );
  }

  const total = items.reduce(
    (sum: number, item: { price: number; qty: number }) =>
      sum + item.price * item.qty,
    0
  );

  try {
    const transaction = await prisma.transaction.create({
      data: {
        storeId,
        total,
        paymentMethod: paymentMethod ?? "cash",
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
      include: { items: true },
    });

    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      });
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}

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