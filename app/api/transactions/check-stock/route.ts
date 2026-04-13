// app/api/transactions/check-stock/route.ts
//
// 🔥 Endpoint ini dipanggil SEBELUM generate token Midtrans pada QRIS.
//    Tujuannya: blokir transaksi jika stok tidak mencukupi,
//    sehingga user tidak sampai membayar untuk barang yang tidak tersedia.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CheckItem {
  productId: string;
  qty: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, items } = body as { storeId: string; items: CheckItem[] };

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Request tidak valid" },
        { status: 400 }
      );
    }

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, storeId },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Produk tidak ditemukan` },
          { status: 400 }
        );
      }

      if (product.stock < item.qty) {
        return NextResponse.json(
          {
            error: `Stok "${product.name}" tidak cukup (sisa: ${product.stock})`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[check-stock] Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}