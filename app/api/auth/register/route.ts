import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validateRegistrationEmail, validateWhatsappNumber } from "@/lib/register-validation";

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

  const emailValidation = validateRegistrationEmail(email);
  if (!emailValidation.valid || !emailValidation.normalized) {
    return NextResponse.json({ error: emailValidation.error ?? "Email tidak valid" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
  }

  const phoneValidation = validateWhatsappNumber(phone, "No. WhatsApp");
  if (!phoneValidation.valid || !phoneValidation.normalized) {
    return NextResponse.json(
      { error: phoneValidation.error ?? "No. WhatsApp tidak valid" },
      { status: 400 }
    );
  }

  const cleanWaNumber = waNumber?.trim()
    ? validateWhatsappNumber(waNumber, "No. WA toko")
    : { valid: true, normalized: phoneValidation.normalized };
  if (!cleanWaNumber.valid || !cleanWaNumber.normalized) {
    return NextResponse.json(
      { error: cleanWaNumber.error ?? "No. WA toko tidak valid" },
      { status: 400 }
    );
  }

  const normalizedEmail = emailValidation.normalized;
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
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + codeRecord.durationDays);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: ownerName.trim(),
          phone: phoneValidation.normalized,
          stores: {
            create: {
              name: storeName.trim(),
              type: storeType?.trim() || "cafe",
              address: storeAddress?.trim() || null,
              waNumber: cleanWaNumber.normalized || null,
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
