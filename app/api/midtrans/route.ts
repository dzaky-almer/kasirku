import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiBaseUrl, getSnapBaseUrl, resolveMidtransConfig } from "@/lib/midtrans-config";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
    }

    const { orderId, total, storeId, bookingId, itemDetails, customer } = body as {
      orderId?: string;
      total?: number;
      storeId?: string;
      bookingId?: string;
      itemDetails?: Array<{
        id?: string;
        price: number;
        quantity?: number;
        name: string;
      }>;
      customer?: {
        first_name?: string;
        phone?: string;
      };
    };

    if (!orderId || !total) {
      return NextResponse.json(
        { error: "orderId dan total wajib diisi" },
        { status: 400 }
      );
    }

    let resolvedStoreId = typeof storeId === "string" ? storeId : null;

    if (!resolvedStoreId && bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { storeId: true },
      });
      resolvedStoreId = booking?.storeId ?? null;
    }

    const { serverKey, clientKey, isProduction } = await resolveMidtransConfig(resolvedStoreId);
    if (!serverKey) {
      return NextResponse.json({ error: "Midtrans server key belum tersedia" }, { status: 400 });
    }
    if (!clientKey) {
      return NextResponse.json({ error: "Midtrans client key belum tersedia" }, { status: 400 });
    }

    const auth = Buffer.from(serverKey + ":").toString("base64");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: total,
      },
      enabled_payments: ["qris"],
      item_details: Array.isArray(itemDetails) && itemDetails.length > 0
        ? itemDetails.map((item) => ({
            id: item.id,
            price: Math.round(item.price),
            quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
            name: item.name,
          }))
        : undefined,
      customer_details: customer
        ? {
            first_name: customer.first_name,
            phone: customer.phone,
          }
        : undefined,
      callbacks: {
        finish: `${appUrl}/booking/payment-finish?order_id=${encodeURIComponent(orderId)}`,
        error: `${appUrl}/booking/payment-error?order_id=${encodeURIComponent(orderId)}`,
        pending: `${appUrl}/booking/payment-pending?order_id=${encodeURIComponent(orderId)}`,
      },
      expiry: {
        unit: "hour",
        duration: 2,
      },
    };

    const response = await fetch(
      `${getSnapBaseUrl(isProduction)}/snap/v1/transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Midtrans error", detail: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      token: data.token,
      redirectUrl: data.redirect_url ?? null,
      orderId,
      clientKey,
      isProduction,
    });

  } catch (err) {
    console.error("MIDTRANS ERROR:", err);

    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const storeId = searchParams.get("storeId");
  const mode = searchParams.get("mode");

  if (mode === "config") {
    const { clientKey, isProduction } = await resolveMidtransConfig(storeId);

    if (!clientKey) {
      return NextResponse.json({ error: "Midtrans client key belum tersedia" }, { status: 400 });
    }

    return NextResponse.json({ clientKey, isProduction });
  }

  if (!orderId) {
    return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 });
  }

  let resolvedStoreId = storeId;
  if (!resolvedStoreId) {
    const booking = await prisma.booking.findFirst({
      where: { paymentOrderId: orderId },
      select: { storeId: true },
    });
    resolvedStoreId = booking?.storeId ?? null;
  }

  const { serverKey, isProduction } = await resolveMidtransConfig(resolvedStoreId);
  if (!serverKey) {
    return NextResponse.json({ error: "Midtrans server key belum tersedia" }, { status: 400 });
  }

  const auth = Buffer.from(serverKey + ":").toString("base64");

  const response = await fetch(
    `${getApiBaseUrl(isProduction)}/v2/${orderId}/status`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
