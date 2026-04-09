import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const date = searchParams.get("date");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  // Resolve date range
  let start: Date;
  let end: Date;

  if (dateFrom && dateTo) {
    start = new Date(`${dateFrom}T00:00:00.000`);
    end = new Date(`${dateTo}T23:59:59.999`);
  } else {
    const target = date ? new Date(date) : new Date();
    start = new Date(target);
    start.setHours(0, 0, 0, 0);
    end = new Date(target);
    end.setHours(23, 59, 59, 999);
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

  // Summary
  const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
  const totalTransactions = transactions.length;
  const totalItems = transactions.reduce(
    (s, t) => s + t.items.reduce((si, i) => si + i.qty, 0),
    0
  );
  const avgTransaction = totalTransactions > 0
    ? Math.round(totalRevenue / totalTransactions)
    : 0;

  // Top produk (by qty dan omzet)
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const trx of transactions) {
    for (const item of trx.items) {
      const key = item.productId;
      if (!productMap[key]) {
        productMap[key] = { name: item.product?.name ?? item.productId, qty: 0, revenue: 0 };
      }
      productMap[key].qty += item.qty;
      productMap[key].revenue += item.qty * item.price;
    }
  }
  const topProducts = Object.entries(productMap)
    .map(([id, v]) => ({ productId: id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Chart data per hari
  const dailyMap: Record<string, { date: string; revenue: number; transactions: number }> = {};
  for (const trx of transactions) {
    const day = trx.createdAt.toISOString().split("T")[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, transactions: 0 };
    dailyMap[day].revenue += trx.total;
    dailyMap[day].transactions += 1;
  }
  const dailyChart = Object.values(dailyMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Peak hour (jam ramai)
  const hourMap: Record<number, number> = {};
  for (const trx of transactions) {
    const h = new Date(trx.createdAt).getHours();
    hourMap[h] = (hourMap[h] ?? 0) + 1;
  }
  const hourChart = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    count: hourMap[h] ?? 0,
  }));

  return NextResponse.json({
    dateFrom: start.toISOString().split("T")[0],
    dateTo: end.toISOString().split("T")[0],
    summary: { totalRevenue, totalTransactions, totalItems, avgTransaction },
    topProducts,
    dailyChart,
    hourChart,
    transactions,
  });
}