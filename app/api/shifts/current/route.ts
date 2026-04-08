import { prisma } from "@/lib/prisma";

export async function GET() {
  const shift = await prisma.shift.findFirst({
    where: { status: "OPEN" }
  });

  return Response.json(shift);
}