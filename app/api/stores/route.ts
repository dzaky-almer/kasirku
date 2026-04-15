import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

  const body = await req.json();
  const { name, type } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name dan type wajib diisi" },
      { status: 400 }
    );
  }

  const store = await prisma.store.create({
    data: { name, type, userId },
  });

  return NextResponse.json(store, { status: 201 });
}
