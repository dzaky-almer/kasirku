import { prisma } from "@/lib/prisma";

const SANDBOX_OVERRIDE_EMAIL = (process.env.MIDTRANS_SANDBOX_OVERRIDE_EMAIL || "user2@toko.com")
  .trim()
  .toLowerCase();

export function isProductionFlagEnabled() {
  return String(process.env.MIDTRANS_IS_PRODUCTION ?? process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION ?? "false").toLowerCase() === "true";
}

export function getSnapBaseUrl(isProduction: boolean) {
  return isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
}

export function getApiBaseUrl(isProduction: boolean) {
  return isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

export async function resolveMidtransConfig(storeId?: string | null) {
  const fallbackServerKey = process.env.MIDTRANS_SERVER_KEY ?? null;
  const fallbackClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? null;
  const fallbackIsProduction = isProductionFlagEnabled();

  if (!storeId) {
    return {
      serverKey: fallbackServerKey,
      clientKey: fallbackClientKey,
      isProduction: fallbackIsProduction,
      source: "env" as const,
      sandboxOverride: false,
    };
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      midtransServerKey: true,
      midtransClientKey: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const ownerEmail = store?.user.email?.trim().toLowerCase() || "";
  const sandboxOverride = ownerEmail === SANDBOX_OVERRIDE_EMAIL;

  if (sandboxOverride) {
    return {
      serverKey: fallbackServerKey,
      clientKey: fallbackClientKey,
      isProduction: false,
      source: "env" as const,
      sandboxOverride: true,
    };
  }

  return {
    serverKey: store?.midtransServerKey || fallbackServerKey,
    clientKey: store?.midtransClientKey || fallbackClientKey,
    isProduction: fallbackIsProduction,
    source: store?.midtransServerKey || store?.midtransClientKey ? "store" as const : "env" as const,
    sandboxOverride: false,
  };
}
