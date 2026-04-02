import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Laporan penjualan harian
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date"); // format: YYYY-MM-DD

  if (!storeId) {
    return NextResponse.json(
      { error: "storeId wajib diisi" },
      { status: 400 }
    );
  }

  // Tentukan range tanggal (hari ini kalau tidak ada date)
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      storeId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  // Hitung summary
  const totalRevenue = transactions.reduce(
    (sum, trx) => sum + trx.total,
    0
  );
  const totalTransactions = transactions.length;
  const totalItems = transactions.reduce(
    (sum, trx) =>
      sum + trx.items.reduce((s, item) => s + item.qty, 0),
    0
  );

  return NextResponse.json({
    date: targetDate.toISOString().split("T")[0],
    summary: {
      totalRevenue,
      totalTransactions,
      totalItems,
    },
    transactions,
  });
}