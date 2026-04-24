import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

const postHandler = async (req: Request) => {
  const session = await auth();
  const userId = session?.user?.id;
  const { shiftId, closing_cash, notes } = await req.json();

  const existingShift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      userId: true,
      storeId: true,
      opening_cash: true,
      status: true,
    },
  });

  if (!existingShift || existingShift.status !== "OPEN") {
    return Response.json(
      { error: "Shift tidak ditemukan atau sudah ditutup" },
      { status: 404 }
    );
  }

  const store = await canAccessStore(existingShift.storeId, userId);

  if (!store) {
    return Response.json(
      { error: "Shift tidak ditemukan atau tidak bisa diakses" },
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
    where: { id: existingShift.id },
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
};

export const POST = withPlanGuard("shift")(postHandler);
