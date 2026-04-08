import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const { storeId, userId, items: cartItems, paymentMethod, shiftId } = body;

  // validasi shift
  if (!shiftId) {
    return NextResponse.json(
      { error: "Shift belum dibuka" },
      { status: 400 }
    );
  }

  if (!storeId || !userId || !cartItems || cartItems.length === 0) {
    return NextResponse.json(
      { error: "storeId, userId, dan items wajib diisi" },
      { status: 400 }
    );
  }


  const total = cartItems.reduce(
    (sum: number, item: { price: number; qty: number }) =>
      sum + item.price * item.qty,
    0
  );

  
  try {
    const transaction = await prisma.transaction.create({
      data: {
        storeId,
        total,
        shiftId,
        paymentMethod: paymentMethod ?? "cash",
        items: {
          create: cartItems.map((item: any) => ({
            productId: item.productId,
            qty: item.qty,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        total_sales: {
          increment: total,
        },
        total_transactions: {
          increment: 1,
        },
      },
    });

    for (const item of cartItems) {
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