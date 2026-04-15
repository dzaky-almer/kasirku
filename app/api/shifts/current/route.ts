import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return Response.json(
        { error: "storeId wajib diisi" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.findFirst({
      where: {
        storeId,
        status: "OPEN",
      },
      orderBy: {
        opened_at: "desc",
      },
    });

    return Response.json(shift);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
