import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resources = await prisma.bookingResource.findMany({
    where: { storeId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ resources });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const { storeId, type, name, capacity, description } = body as {
    storeId?: string;
    type?: string;
    name?: string;
    capacity?: number | null;
    description?: string | null;
  };

  if (!storeId || !type || !name) {
    return NextResponse.json({ error: "storeId, type, dan name wajib diisi" }, { status: 400 });
  }

  const store = await canAccessStore(storeId, userId);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resource = await prisma.bookingResource.create({
    data: {
      storeId,
      type: type.trim().toUpperCase(),
      name: name.trim(),
      capacity: typeof capacity === "number" && capacity > 0 ? capacity : null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
