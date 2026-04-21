import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      store: {
        select: { userId: true },
      },
    },
  });

  if (!product || product.store.userId !== userId) {
    return NextResponse.json({ error: "Produk tidak ditemukan atau tidak bisa diakses" }, { status: 404 });
  }

  const { bookingEnabled, bookingDurationMin } = body as {
    bookingEnabled?: boolean;
    bookingDurationMin?: number | null;
  };

  const updated = await prisma.product.update({
    where: { id },
    data: {
      bookingEnabled: typeof bookingEnabled === "boolean" ? bookingEnabled : undefined,
      bookingDurationMin:
        typeof bookingDurationMin === "number" && bookingDurationMin > 0
          ? Math.min(Math.max(bookingDurationMin, 5), 480)
          : bookingDurationMin === null
            ? null
            : undefined,
    },
  });

  return NextResponse.json(updated);
}
