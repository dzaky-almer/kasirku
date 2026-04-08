import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { shiftId, closing_cash, notes } = await req.json();

  const transactions = await prisma.transaction.findMany({
    where: { shiftId }
  });

  const total_sales = transactions.reduce((a, t) => a + t.total, 0);

  const shift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      closing_cash,
      total_sales,
      total_transactions: transactions.length,
      status: "CLOSED",
      closed_at: new Date(),
      notes
    }
  });
  const expected = shift.opening_cash + total_sales;
const diff = closing_cash - expected;
  return Response.json({ ...shift, expected, diff });
}