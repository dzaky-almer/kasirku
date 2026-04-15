import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const {
    email,
    password,
    ownerName,
    phone,
    referralCode,
    storeName,
    storeType,
    storeAddress,
    waNumber,
    midtransServerKey,
    midtransClientKey,
  } = body as {
    email?: string;
    password?: string;
    ownerName?: string;
    phone?: string;
    referralCode?: string;
    storeName?: string;
    storeType?: string;
    storeAddress?: string | null;
    waNumber?: string | null;
    midtransServerKey?: string | null;
    midtransClientKey?: string | null;
  };

  if (!email || !password || !ownerName || !phone || !referralCode || !storeName) {
    return NextResponse.json(
      {
        error: "Email, password, nama pemilik, no WA, kode referral, dan nama toko wajib diisi",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone.startsWith("62") || cleanPhone.length < 10) {
    return NextResponse.json(
      { error: "No. WhatsApp harus berformat 628xxxxxxxxx" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = referralCode.trim().toUpperCase();

  const [existingUser, codeRecord] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail } }),
    prisma.referralCode.findUnique({ where: { code: normalizedCode } }),
  ]);

  if (existingUser) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  if (!codeRecord) {
    return NextResponse.json({ error: "Kode referral tidak ditemukan" }, { status: 400 });
  }

  if (!codeRecord.isActive || codeRecord.isUsed) {
    return NextResponse.json({ error: "Kode referral sudah dipakai atau tidak aktif" }, { status: 400 });
  }

  if (codeRecord.expiresAt && new Date() > codeRecord.expiresAt) {
    return NextResponse.json({ error: "Kode referral sudah kedaluwarsa" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const cleanWaNumber = waNumber?.replace(/\D/g, "") || cleanPhone;
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + codeRecord.durationDays);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: ownerName.trim(),
          phone: cleanPhone,
          stores: {
            create: {
              name: storeName.trim(),
              type: storeType?.trim() || "cafe",
              address: storeAddress?.trim() || null,
              waNumber: cleanWaNumber || null,
              midtransServerKey: midtransServerKey?.trim() || null,
              midtransClientKey: midtransClientKey?.trim() || null,
            },
          },
        },
        include: { stores: true },
      });

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          plan: codeRecord.plan,
          tier: codeRecord.tier,
          startDate: new Date(),
          expiredAt,
          status: "active",
        },
      });

      await tx.referralCode.update({
        where: { id: codeRecord.id },
        data: {
          isActive: false,
          isUsed: true,
          usedAt: new Date(),
          usedByUserId: user.id,
        },
      });

      return { user, subscription };
    });

    return NextResponse.json(
      {
        success: true,
        id: result.user.id,
        email: result.user.email,
        storeId: result.user.stores[0]?.id ?? null,
        plan: result.subscription.plan,
        tier: result.subscription.tier,
        expiredAt: result.subscription.expiredAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Gagal membuat akun" }, { status: 500 });
  }
}
