import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const storeId = searchParams.get("storeId"); // optional

  if (!date) {
    return Response.json({ error: "Tanggal wajib diisi" }, { status: 400 });
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const shifts = await prisma.shift.findMany({
    where: {
      opened_at: {
        gte: start,
        lte: end,
      },
      ...(storeId && { storeId }),
    },
    include: {
      user: true, // 🔥 tampilkan kasir
    },
    orderBy: {
      opened_at: "asc",
    },
  });

  // total harian
  const total_sales = shifts.reduce((a, s) => a + s.total_sales, 0);
  const total_transactions = shifts.reduce(
    (a, s) => a + s.total_transactions,
    0
  );

  return Response.json({
    shifts,
    summary: {
      total_sales,
      total_transactions,
    },
  });
}