  import { NextResponse } from "next/server";
  import { prisma } from "@/lib/prisma";

  export async function checkSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        allowed: false,
        message: "Subscription tidak ditemukan",
      };
    }

    const isExpired = new Date() > new Date(subscription.expiredAt);

    if (isExpired) {
      // Update status ke expired
      await prisma.subscription.update({
        where: { userId },
        data: { status: "expired" },
      });

      return {
        allowed: false,
        message: "Subscription sudah expired, silakan perpanjang",
      };
    }

    return { allowed: true, message: "OK" };
  }

  export function subscriptionExpiredResponse() {
    return NextResponse.json(
      {
        error: "Subscription expired. Transaksi tidak bisa dilakukan.",
        code: "SUBSCRIPTION_EXPIRED",
      },
      { status: 403 }
    );
  }