import { prisma } from "@/lib/prisma";
import { formatDateInput, getDateRangeForDay } from "@/lib/date";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const storeId  = searchParams.get("storeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo   = searchParams.get("dateTo");
  const date     = searchParams.get("date");

  // 🔹 Resolve range
  const from = dateFrom ?? date ?? formatDateInput(new Date());
  const to = dateTo ?? date ?? formatDateInput(new Date());

  const start = getDateRangeForDay(from).start;
  const end = getDateRangeForDay(to).end;

  const shifts = await prisma.shift.findMany({
    where: {
      opened_at: { gte: start, lte: end },
      ...(storeId && { storeId }),
    },
    include: { user: true },
    orderBy: [
      { closed_at: "desc" }, 
      { opened_at: "desc" }, 
    ],
  });

  // 🔹 SUMMARY
  const total_sales = shifts.reduce((a, s) => a + s.total_sales, 0);
  const total_transactions = shifts.reduce(
    (a, s) => a + s.total_transactions,
    0
  );

  return Response.json({
    shifts,
    summary: { total_sales, total_transactions },
  });
}
