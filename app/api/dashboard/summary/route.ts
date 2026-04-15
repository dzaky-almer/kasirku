import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { formatDateInput, getDateRangeForDay, shiftDateInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    where: { id: storeId, userId },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json(
      { error: "Store tidak ditemukan atau bukan milik akun ini" },
      { status: 403 }
    );
  }

  const today = formatDateInput(new Date());
  const todayRange = getDateRangeForDay(today);
  const last7Start = getDateRangeForDay(shiftDateInput(today, -6)).start;
  const salesDates = Array.from({ length: 7 }, (_, index) =>
    shiftDateInput(today, -(6 - index))
  );

  const [last7Transactions, todayTransactions, products] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        storeId,
        createdAt: {
          gte: last7Start,
          lte: todayRange.end,
        },
      },
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        storeId,
        createdAt: {
          gte: todayRange.start,
          lte: todayRange.end,
        },
      },
      select: {
        total: true,
        createdAt: true,
        items: {
          select: {
            qty: true,
            price: true,
            productId: true,
            product: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { storeId },
      select: {
        name: true,
        stock: true,
        unit: true,
        minStock: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const salesMap = new Map<string, number>();
  for (const transaction of last7Transactions) {
    const key = formatDateInput(transaction.createdAt);
    salesMap.set(key, (salesMap.get(key) ?? 0) + transaction.total);
  }

  const salesData = salesDates.map((date) => salesMap.get(date) ?? 0);

  const recentTransactions = todayTransactions.slice(0, 5).map((transaction) => ({
    item:
      transaction.items.length > 0
        ? `${transaction.items[0].qty}x item`
        : "Transaksi",
    time: new Date(transaction.createdAt).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    qty: transaction.items.reduce((sum, item) => sum + item.qty, 0),
    amount: transaction.total,
  }));

  const topProductMap: Record<string, { name: string; sold: number; revenue: number }> = {};
  for (const transaction of todayTransactions) {
    for (const item of transaction.items) {
      if (!topProductMap[item.productId]) {
        topProductMap[item.productId] = {
          name: item.product?.name ?? item.productId,
          sold: 0,
          revenue: 0,
        };
      }
      topProductMap[item.productId].sold += item.qty;
      topProductMap[item.productId].revenue += item.qty * item.price;
    }
  }

  const topProducts = Object.values(topProductMap)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const stockList = products.map((product) => ({
    name: product.name,
    stock: product.stock,
    unit: product.unit ?? "pcs",
    status: product.stock <= (product.minStock ?? 5) ? "warn" : "ok",
  }));

  const totalItems = todayTransactions.reduce(
    (sum, transaction) =>
      sum + transaction.items.reduce((itemSum, item) => itemSum + item.qty, 0),
    0
  );

  return NextResponse.json({
    salesData,
    recentTransactions,
    stockList,
    topProducts,
    todaySummary: {
      totalTransactions: todayTransactions.length,
      totalItems,
      totalOmzet: salesData[6] ?? 0,
    },
  });
}
