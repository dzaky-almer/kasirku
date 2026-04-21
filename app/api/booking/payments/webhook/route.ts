import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateSignature(orderId: string, statusCode: string, grossAmount: string, signatureKey: string) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");

  return expected === signatureKey;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const orderId = String(body.order_id ?? "");
  const transactionStatus = String(body.transaction_status ?? "");
  const fraudStatus = String(body.fraud_status ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");

  if (!orderId || !signatureKey) {
    return NextResponse.json({ error: "Payload Midtrans tidak lengkap" }, { status: 400 });
  }

  if (!validateSignature(orderId, statusCode, grossAmount, signatureKey)) {
    return NextResponse.json({ error: "Signature Midtrans tidak valid" }, { status: 403 });
  }

  const booking = await prisma.booking.findFirst({
    where: { paymentOrderId: orderId },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const isPaid = ["capture", "settlement"].includes(transactionStatus) || fraudStatus === "accept";
  const isFailed = ["cancel", "deny", "expire", "failure"].includes(transactionStatus);

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: isPaid ? "CONFIRMED" : undefined,
      dpStatus: isPaid ? "PAID" : isFailed ? "FAILED" : "UNPAID",
      dpPaidAt: isPaid ? new Date() : undefined,
      paymentStatusRaw: transactionStatus,
    },
  });

  return NextResponse.json({ success: true });
}
