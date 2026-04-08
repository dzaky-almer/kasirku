import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { opening_cash, userId, storeId } = await req.json();

    if (!userId || !storeId) {
      return Response.json({ error: "userId & storeId wajib" }, { status: 400 });
    }

    const existing = await prisma.shift.findFirst({
      where: {
        userId,
        status: "OPEN",
      },
    });

    if (existing) {
      return Response.json({ error: "Shift masih aktif" }, { status: 400 });
    }

    const shift = await prisma.shift.create({
      data: {
        opening_cash,
        status: "OPEN",
        userId,
        storeId,
      },
    });

    return Response.json(shift);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}