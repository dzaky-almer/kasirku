import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const shift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
    });

    return Response.json(shift);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}