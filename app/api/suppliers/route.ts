import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

const getHandler = async (req: Request) => {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { storeId },
    include: {
      _count: {
        select: {
          products: true,
          stockMovements: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
};

const postHandler = async (req: Request) => {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json().catch(() => null);

  const storeId = (body?.storeId as string | undefined)?.trim();
  const name = (body?.name as string | undefined)?.trim();

  if (!storeId || !name) {
    return NextResponse.json({ error: "storeId dan nama supplier wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      storeId,
      name,
      phone: (body?.phone as string | undefined)?.trim() || null,
      email: (body?.email as string | undefined)?.trim() || null,
      address: (body?.address as string | undefined)?.trim() || null,
      notes: (body?.notes as string | undefined)?.trim() || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
};

export const GET = withPlanGuard("supplier")(getHandler);
export const POST = withPlanGuard("supplier")(postHandler);
