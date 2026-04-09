import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const storeId  = searchParams.get("storeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo   = searchParams.get("dateTo");
  const date     = searchParams.get("date");

  // 🔹 Resolve range
  const from = dateFrom ?? date ?? new Date().toISOString().split("T")[0];
  const to   = dateTo   ?? date ?? new Date().toISOString().split("T")[0];

  const start = new Date(`${from}T00:00:00.000Z`);
  const end   = new Date(`${to}T23:59:59.999Z`);

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