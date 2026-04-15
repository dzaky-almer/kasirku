import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { shiftId, closing_cash, notes } = await req.json();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      userId,
      status: "OPEN",
    },
  });

  if (!shift) {
    return Response.json(
      { error: "Shift tidak ditemukan atau bukan milik akun ini" },
      { status: 403 }
    );
  }

  const transactionSummary = await prisma.transaction.aggregate({
    where: { shiftId },
    _sum: { total: true },
    _count: { id: true },
  });

  const totalSales = transactionSummary._sum.total ?? 0;

  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      closing_cash,
      total_sales: totalSales,
      total_transactions: transactionSummary._count.id,
      status: "CLOSED",
      closed_at: new Date(),
      notes,
    },
  });

  const expected = updatedShift.opening_cash + totalSales;
  const diff = closing_cash - expected;

  return Response.json({ ...updatedShift, expected, diff });
}
