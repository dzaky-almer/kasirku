import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          stock: true,
          unit: true,
          category: true,
        },
        orderBy: { name: "asc" },
      },
      stockMovements: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
        },
      },
    },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(supplier.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(supplier);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const existing = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, storeId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(existing.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: (body?.name as string | undefined)?.trim() || undefined,
      phone: (body?.phone as string | undefined)?.trim() || null,
      email: (body?.email as string | undefined)?.trim() || null,
      address: (body?.address as string | undefined)?.trim() || null,
      notes: (body?.notes as string | undefined)?.trim() || null,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
    },
  });

  return NextResponse.json(supplier);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  const existing = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, storeId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
  }

  const store = await canAccessStore(existing.storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.product.updateMany({
    where: { supplierId: id },
    data: { supplierId: null },
  });

  await prisma.stockMovement.updateMany({
    where: { supplierId: id },
    data: { supplierId: null },
  });

  await prisma.supplier.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
