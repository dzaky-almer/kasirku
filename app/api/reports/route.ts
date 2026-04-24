import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { formatDateInput, getDateRangeForDay } from "@/lib/date";
import { canAccessStore } from "@/lib/store-access";

const getHandler = async (req: Request) => {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
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

  let start: Date;
  let end: Date;

  if (dateFrom && dateTo) {
    start = getDateRangeForDay(dateFrom).start;
    end = getDateRangeForDay(dateTo).end;
  } else {
    const targetDate = date ?? formatDateInput(new Date());
    const range = getDateRangeForDay(targetDate);
    start = range.start;
    end = range.end;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      storeId,
      createdAt: { gte: start, lte: end },
    },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const completedTransactions = transactions.filter(
    (transaction) => transaction.status === "COMPLETED"
  );

  const totalRevenue = completedTransactions.reduce((s, t) => s + t.total, 0);
  const totalTransactions = completedTransactions.length;
  const totalItems = completedTransactions.reduce(
    (s, t) => s + t.items.reduce((si, i) => si + i.qty, 0),
    0
  );
  const avgTransaction =
    totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const trx of completedTransactions) {
    for (const item of trx.items) {
      const key = item.productId;
      if (!productMap[key]) {
        productMap[key] = {
          name: item.product?.name ?? item.productId,
          qty: 0,
          revenue: 0,
        };
      }
      productMap[key].qty += item.qty;
      productMap[key].revenue += item.qty * item.price;
    }
  }

  const topProducts = Object.entries(productMap)
    .map(([id, value]) => ({ productId: id, ...value }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const products = await prisma.product.findMany({
    where: { storeId },
    select: {
      id: true,
      name: true,
      stock: true,
      supplierId: true,
      supplier: {
        select: {
          name: true,
        },
      },
      transactionItems: {
        where: {
          transaction: {
            status: "COMPLETED",
          },
        },
        select: {
          qty: true,
          transaction: {
            select: {
              createdAt: true,
            },
          },
        },
        orderBy: {
          transaction: {
            createdAt: "desc",
          },
        },
      },
    },
  });

  const slowProducts = products
    .map((product) => {
      const soldInPeriod = product.transactionItems.filter((item) => {
        const createdAt = item.transaction.createdAt;
        return createdAt >= start && createdAt <= end;
      });
      const lastSoldAt = product.transactionItems[0]?.transaction.createdAt ?? null;

      return {
        productId: product.id,
        name: product.name,
        stock: product.stock,
        supplierId: product.supplierId,
        supplierName: product.supplier?.name ?? null,
        lastSoldAt: lastSoldAt ? lastSoldAt.toISOString() : null,
        daysSinceLastSold: lastSoldAt
          ? Math.floor((Date.now() - lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        totalSoldThisPeriod: soldInPeriod.reduce((sum, item) => sum + item.qty, 0),
      };
    })
    .filter((product) => product.stock > 0)
    .sort((a, b) => {
      const daysA = a.daysSinceLastSold ?? 9999;
      const daysB = b.daysSinceLastSold ?? 9999;
      return daysB - daysA;
    });

  const dailyMap: Record<string, { date: string; revenue: number; transactions: number }> = {};
  for (const trx of completedTransactions) {
    const day = formatDateInput(trx.createdAt);
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, revenue: 0, transactions: 0 };
    }
    dailyMap[day].revenue += trx.total;
    dailyMap[day].transactions += 1;
  }

  const dailyChart = Object.values(dailyMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const hourMap: Record<number, number> = {};
  for (const trx of completedTransactions) {
    const hour = new Date(trx.createdAt).getHours();
    hourMap[hour] = (hourMap[hour] ?? 0) + 1;
  }

  const hourChart = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    count: hourMap[hour] ?? 0,
  }));

  return NextResponse.json({
    dateFrom: dateFrom ?? date ?? formatDateInput(start),
    dateTo: dateTo ?? date ?? formatDateInput(end),
    summary: { totalRevenue, totalTransactions, totalItems, avgTransaction },
    topProducts,
    slowProducts,
    dailyChart,
    hourChart,
    transactions,
  });
};

export const GET = withPlanGuard("laporan_produk")(getHandler);
