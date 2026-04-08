import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { opening_cash, userId } = await req.json();

  // cek apakah masih ada shift aktif
  const existing = await prisma.shift.findFirst({
    where: {
      userId,
      status: "OPEN"
    }
  });

  if (existing) {
    return Response.json({ error: "Shift masih aktif" }, { status: 400 });
  }

  const shift = await prisma.shift.create({
    data: {
      opening_cash,
      status: "OPEN",
      userId
    }
  });

  return Response.json(shift);
}