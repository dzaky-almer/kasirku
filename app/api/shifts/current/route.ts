import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const userId = searchParams.get("userId");

    const shift = await prisma.shift.findFirst({
      where: {
        status: "OPEN",
        ...(storeId ? { storeId } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { opened_at: "desc" },
    });

    return Response.json(shift);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
