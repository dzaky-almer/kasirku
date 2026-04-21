import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateUniqueStoreSlug } from "@/lib/slug";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stores = await prisma.store.findMany({
    where: { userId },
  });

  return NextResponse.json(stores);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { name, type } = (body ?? {}) as {
    name?: string;
    type?: string;
  };

  if (!name || !type) {
    return NextResponse.json(
      { error: "name dan type wajib diisi" },
      { status: 400 }
    );
  }

  const slug = await generateUniqueStoreSlug(name);
  const store = await prisma.store.create({
    data: {
      name,
      slug,
      type,
      userId,
    },
  });

  return NextResponse.json(store, { status: 201 });
}
