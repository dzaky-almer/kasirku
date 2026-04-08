import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password, storeName, storeType, address, phone } = body;

  if (!email || !password || !storeName) {
    return NextResponse.json(
      { error: "email, password, dan nama toko wajib diisi" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      stores: {
        create: {
          name: storeName,
          type: storeType ?? "cafe",
          address: address ?? null,
          phone: phone ?? null,
        },
      },
    },
    include: { stores: true },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, storeId: user.stores[0]?.id ?? null },
    { status: 201 }
  );
}