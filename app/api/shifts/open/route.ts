import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const body = await req.json();
    const { opening_cash, storeId, cashierName } = body;

    if (!sessionUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!storeId) {
      return Response.json({ error: "storeId wajib" }, { status: 400 });
    }

    if (!opening_cash || opening_cash < 0) {
      return Response.json(
        { error: "Opening cash tidak valid" },
        { status: 400 }
      );
    }

    if (!cashierName || cashierName.trim() === "") {
      return Response.json(
        { error: "Nama kasir wajib diisi" },
        { status: 400 }
      );
    }

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        userId: sessionUserId,
      },
      select: { id: true },
    });

    if (!store) {
      return Response.json(
        { error: "Store tidak ditemukan atau bukan milik akun ini" },
        { status: 403 }
      );
    }

    const existing = await prisma.shift.findFirst({
      where: {
        userId: sessionUserId,
        storeId,
        status: "OPEN",
      },
    });

    if (existing) {
      return Response.json(
        { error: "Masih ada shift yang belum ditutup" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        opening_cash,
        cashierName,
        status: "OPEN",
        userId: sessionUserId,
        storeId,
      },
    });

    return Response.json(shift, { status: 201 });
  } catch (err) {
    console.error("OPEN SHIFT ERROR:", err);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
