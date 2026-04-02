import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Ambil store by userId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId wajib diisi" },
      { status: 400 }
    );
  }

  const stores = await prisma.store.findMany({
    where: { userId },
  });

  return NextResponse.json(stores);
}

// POST - Buat store baru
export async function POST(req: Request) {
  const body = await req.json();
  const { name, type, userId } = body;

  if (!name || !type || !userId) {
    return NextResponse.json(
      { error: "name, type, userId wajib diisi" },
      { status: 400 }
    );
  }

  const store = await prisma.store.create({
    data: { name, type, userId },
  });

  return NextResponse.json(store, { status: 201 });
}