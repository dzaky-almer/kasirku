import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { opening_cash, userId, storeId, cashierName } = body;

    // 🔒 VALIDASI
    if (!userId || !storeId) {
      return Response.json(
        { error: "userId & storeId wajib" },
        { status: 400 }
      );
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

    // 🔥 CEK SHIFT AKTIF (PER USER)
    const existing = await prisma.shift.findFirst({
      where: {
        userId,
        status: "OPEN",
      },
    });

    if (existing) {
      return Response.json(
        { error: "Masih ada shift yang belum ditutup" },
        { status: 400 }
      );
    }

    // ✅ CREATE SHIFT
    const shift = await prisma.shift.create({
      data: {
        opening_cash,
        cashierName, 
        status: "OPEN",
        userId,
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