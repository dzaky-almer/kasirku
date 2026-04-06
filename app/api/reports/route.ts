import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  const date = searchParams.get("date");

  if (!storeId) {
    return NextResponse.json(
      { error: "storeId wajib diisi" },
      { status: 400 }
    );
  }

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
    include: {
      items: {
        include: {
          product: { select: { name: true } }, // ← nama produk
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

 const totalRevenue = transactions.reduce((sum: number, trx: typeof transactions[0]) => sum + trx.total, 0);
const totalTransactions = transactions.length;
const totalItems = transactions.reduce(
  (sum: number, trx: typeof transactions[0]) =>
    sum + trx.items.reduce((s: number, item: typeof transactions[0]["items"][0]) => s + item.qty, 0),
  0
);
  return NextResponse.json({
    date: targetDate.toISOString().split("T")[0],
    summary: { totalRevenue, totalTransactions, totalItems },
    transactions,
  });
}