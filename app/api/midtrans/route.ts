import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("=== MIDTRANS ROUTE HIT ===");

    const body = await req.json();
    const { orderId, total } = body;

    if (!orderId || !total) {
      return NextResponse.json(
        { error: "orderId dan total wajib diisi" },
        { status: 400 }
      );
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const auth = Buffer.from(serverKey + ":").toString("base64");

    const response = await fetch(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: total,
          },
        }),
      }
    );

    const data = await response.json();

    console.log("Midtrans response status:", response.status);
    console.log("Midtrans response data:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Midtrans error", detail: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ token: data.token, orderId });

  } catch (err: any) {
    console.error("MIDTRANS ERROR:", err);

    return NextResponse.json(
      { error: "Internal server error", detail: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const auth = Buffer.from(serverKey + ":").toString("base64");

  const response = await fetch(
    `https://api.sandbox.midtrans.com/v2/${orderId}/status`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}