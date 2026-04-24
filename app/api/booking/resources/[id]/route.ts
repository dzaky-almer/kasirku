import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { prisma } from "@/lib/prisma";

const patchHandler = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const existing = await prisma.bookingResource.findUnique({
    where: { id },
    include: {
      store: {
        select: { userId: true },
      },
    },
  });

  if (!existing || existing.store.userId !== userId) {
    return NextResponse.json({ error: "Resource tidak ditemukan atau tidak bisa diakses" }, { status: 404 });
  }

  const { isActive, name, capacity, description } = body as {
    isActive?: boolean;
    name?: string;
    capacity?: number | null;
    description?: string | null;
  };

  const updated = await prisma.bookingResource.update({
    where: { id },
    data: {
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      name: typeof name === "string" && name.trim() ? name.trim() : undefined,
      capacity: typeof capacity === "number" && capacity > 0 ? capacity : capacity === null ? null : undefined,
      description: typeof description === "string" ? description.trim() || null : description === null ? null : undefined,
    },
  });

  return NextResponse.json(updated);
};

const deleteHandler = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.bookingResource.findUnique({
    where: { id },
    include: {
      store: {
        select: { userId: true },
      },
    },
  });

  if (!existing || existing.store.userId !== userId) {
    return NextResponse.json({ error: "Resource tidak ditemukan atau tidak bisa diakses" }, { status: 404 });
  }

  await prisma.bookingResource.delete({ where: { id } });
  return NextResponse.json({ success: true });
};

export const PATCH = withPlanGuard("booking")(patchHandler);
export const DELETE = withPlanGuard("booking")(deleteHandler);
