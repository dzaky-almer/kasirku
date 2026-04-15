import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getDateRangeForDay } from "@/lib/date";
import { canAccessStore } from "@/lib/store-access";

interface CartItemInput {
  productId: string;
  qty: number;
  price: number;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Transaksi gagal";
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json();
  const {
    storeId,
    items: cartItems,
    paymentMethod,
    shiftId,
    promoId,
    discountAmount,
  } = body as {
    storeId?: string;
    items?: CartItemInput[];
    paymentMethod?: string;
    shiftId?: string;
    promoId?: string | null;
    discountAmount?: number;
  };

  if (!shiftId) {
    return NextResponse.json({ error: "Shift belum dibuka" }, { status: 400 });
  }

  if (!storeId || !Array.isArray(cartItems) || cartItems.length === 0) {
    return NextResponse.json(
      { error: "storeId dan items wajib diisi" },
      { status: 400 }
    );
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const discount = typeof discountAmount === "number" ? discountAmount : 0;
  const total = Math.max(0, subtotal - discount);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const store = await canAccessStore(storeId, userId);

      if (!store) {
        throw new Error("Store tidak ditemukan atau tidak bisa diakses");
      }

      const shift = await tx.shift.findFirst({
        where: {
          id: shiftId,
          storeId,
          status: "OPEN",
          ...(store.isDemo ? {} : { userId }),
        },
        select: { id: true },
      });

      if (!shift) {
        throw new Error("Shift tidak valid untuk toko ini");
      }

      for (const item of cartItems) {
        const res = await tx.product.updateMany({
          where: {
            id: item.productId,
            storeId,
            stock: { gte: item.qty },
          },
          data: {
            stock: { decrement: item.qty },
          },
        });

        if (res.count === 0) {
          throw new Error("Stok produk tidak cukup / sudah habis");
        }
      }

      if (promoId) {
        const promo = await tx.promo.findFirst({
          where: { id: promoId, storeId },
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

      const transaction = await tx.transaction.create({
        data: {
          storeId,
          total,
          discountAmount: discount,
          shiftId,
          paymentMethod: paymentMethod ?? "cash",
          ...(promoId ? { promoId } : {}),
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              price: item.price,
            })),
          },
        },
        include: { items: true },
      });

      if (promoId) {
        await tx.promo.update({
          where: { id: promoId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

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
  } catch (error: unknown) {
    console.error("Transaction error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);

  if (!store) {
    return NextResponse.json(
      { error: "Store tidak ditemukan atau tidak bisa diakses" },
      { status: 403 }
    );
  }

  const dateFilter = date ? getDateRangeForDay(date) : null;

  const transactions = await prisma.transaction.findMany({
    where: {
      storeId,
      ...(dateFilter && {
        createdAt: {
          gte: dateFilter.start,
          lte: dateFilter.end,
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
            take: 1,
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
