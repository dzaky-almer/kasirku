import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getDateRangeForDay } from "@/lib/date";
import { canAccessStore } from "@/lib/store-access";
import { createStockMovement } from "@/lib/inventory";
import { normalizePlan } from "@/lib/subscription-plan";

interface CartItemInput {
  productId: string;
  qty: number;
  price: number;
  note?: string;
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
      const draftReferenceId = crypto.randomUUID();
      const store = await canAccessStore(storeId, userId);

      if (!store) {
        throw new Error("Store tidak ditemukan atau tidak bisa diakses");
      }

      const subscription =
        store.isDemo || !userId
          ? null
          : await tx.subscription.findUnique({
              where: { userId },
              select: { plan: true },
            });

      const plan = normalizePlan(subscription?.plan);
      const requiresManualShift = plan !== "basic" && !store.isDemo;

      if (!shiftId && requiresManualShift) {
        throw new Error("Shift belum dibuka");
      }

      let shift = shiftId
        ? await tx.shift.findFirst({
            where: {
              id: shiftId,
              storeId,
              status: "OPEN",
              ...(store.isDemo ? {} : { userId }),
            },
            select: { id: true },
          })
        : null;

      if (!shift && !requiresManualShift) {
        shift = await tx.shift.findFirst({
          where: {
            storeId,
            status: "OPEN",
            ...(userId ? { userId } : {}),
            notes: "AUTO_SHIFT_BASIC_PLAN",
          },
          select: { id: true },
        });

        if (!shift) {
          if (!userId) {
            throw new Error("User tidak valid untuk transaksi");
          }

          shift = await tx.shift.create({
            data: {
              opening_cash: 0,
              total_sales: 0,
              total_transactions: 0,
              status: "OPEN",
              notes: "AUTO_SHIFT_BASIC_PLAN",
              userId,
              cashierName: "Kasir Basic",
              storeId,
            },
            select: { id: true },
          });
        }
      }

      if (!shift) {
        throw new Error("Shift tidak valid untuk toko ini");
      }

      for (const item of cartItems) {
        await createStockMovement(tx, {
          storeId,
          productId: item.productId,
          type: "OUT",
          reason: "SALE",
          qtyChange: -item.qty,
          createdById: userId ?? null,
          referenceType: "TRANSACTION_DRAFT",
          referenceId: draftReferenceId,
          note: "Pengurangan stok dari transaksi kasir",
        });
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
          shiftId: shift.id,
          paymentMethod: paymentMethod ?? "cash",
          ...(promoId ? { promoId } : {}),
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              price: item.price,
              note: item.note?.trim() || null,
            })),
          },
        },
        include: { items: true },
      });

      await Promise.all(
        cartItems.map((item) =>
          tx.stockMovement.updateMany({
            where: {
              storeId,
              productId: item.productId,
              reason: "SALE",
              referenceType: "TRANSACTION_DRAFT",
              referenceId: draftReferenceId,
            },
            data: {
              referenceType: "TRANSACTION",
              referenceId: transaction.id,
            },
          })
        )
      );

      if (promoId) {
        await tx.promo.update({
          where: { id: promoId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

      await tx.shift.update({
        where: { id: shift.id },
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
      status: "COMPLETED",
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
