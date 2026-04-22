import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const action = body?.action as "VOID" | "REFUND" | undefined;
  const reason = (body?.reason as string | undefined)?.trim() ?? "";

  if (!action || !["VOID", "REFUND"].includes(action)) {
    return NextResponse.json({ error: "action tidak valid" }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json({ error: "Alasan wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: {
      items: true,
      shift: {
        select: {
          id: true,
          storeId: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(existing.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (existing.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Transaksi ini sudah pernah di-void atau di-refund" },
      { status: 400 }
    );
  }

  const nextStatus = action === "VOID" ? "VOID" : "REFUNDED";

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.qty },
        },
      });
    }

    await tx.shift.update({
      where: { id: existing.shiftId },
      data: {
        total_sales: { decrement: existing.total },
        total_transactions: { decrement: 1 },
      },
    });

    return tx.transaction.update({
      where: { id: existing.id },
      data:
        action === "VOID"
          ? {
              status: nextStatus,
              voidReason: reason,
              voidedAt: new Date(),
            }
          : {
              status: nextStatus,
              refundReason: reason,
              refundedAt: new Date(),
            },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });
  });

  return NextResponse.json(updated);
}
