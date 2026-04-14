import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const {
    storeId,
    userId,
    items: cartItems,
    paymentMethod,
    shiftId,
    promoId,
    discountAmount
  } = body;

  // VALIDASI BASIC
  if (!shiftId) {
    return NextResponse.json({ error: "Shift belum dibuka" }, { status: 400 });
  }

  if (!storeId || !userId || !cartItems || cartItems.length === 0) {
    return NextResponse.json(
      { error: "storeId, userId, dan items wajib diisi" },
      { status: 400 }
    );
  }

  const subtotal = cartItems.reduce(
    (sum: number, item: { price: number; qty: number }) =>
      sum + item.price * item.qty,
    0
  );

  const discount = typeof discountAmount === "number" ? discountAmount : 0;
  const total = Math.max(0, subtotal - discount);

  try {
    const result = await prisma.$transaction(async (tx) => {

      // 🔥 1. VALIDASI & KURANGI STOK (ANTI MINUS)
      for (const item of cartItems) {
        const res = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.qty }, // pastikan stok cukup
          },
          data: {
            stock: { decrement: item.qty },
          },
        });

        // kalau gagal update = stok tidak cukup
        if (res.count === 0) {
          throw new Error(`Stok produk tidak cukup / sudah habis`);
        }
      }

      if (promoId) {
  const promo = await tx.promo.findUnique({
    where: { id: promoId },
  });

  if (!promo) {
    throw new Error("Promo tidak ditemukan");
  }

  if (!promo.isActive) {
    throw new Error("Promo tidak aktif");
  }

  if (promo.maxUsage && promo.usageCount >= promo.maxUsage) {
    throw new Error("Promo sudah mencapai batas penggunaan");
  }
}

      // 🔥 2. BUAT TRANSAKSI
      const transaction = await tx.transaction.create({
        data: {
          storeId,
          total,
          discountAmount: discount,
          shiftId,
          paymentMethod: paymentMethod ?? "cash",
          ...(promoId ? { promoId } : {}),
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

      // 🔥 2.5 UPDATE PROMO USAGE
if (promoId) {
  await tx.promo.update({
    where: { id: promoId },
    data: {
      usageCount: { increment: 1 },
    },
  });
} 

      // 🔥 3. UPDATE SHIFT
      await tx.shift.update({
        where: { id: shiftId },
        data: {
          total_sales: { increment: total },
          total_transactions: { increment: 1 },
        },
      });

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error("Transaction error:", error);

    return NextResponse.json(
      {
        error: error.message || "Transaksi gagal",
      },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      storeId,
      ...(date && {
        createdAt: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lte: new Date(`${date}T23:59:59.999Z`),
        },
      }),
    },
include: {
  items: true,
  promo: {
    select: {
      id: true,
      name: true,
      rules: {
        take: 1, // ambil rule pertama aja
        select: {
          discountType: true,
          discountValue: true,
        },
      },
    },
  },
},
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}