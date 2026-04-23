"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function BookingSuccesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BookingSuccesContent />
    </Suspense>
  );
}

function BookingSuccesContent() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const bookingId = params.get("id");
  const status = params.get("status");
  const isPending = status === "pending";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl ${isPending ? "bg-amber-100" : "bg-emerald-100"}`}>
          {isPending ? "..." : "OK"}
        </div>

        <h1 className="text-xl font-black text-gray-900 mb-2">
          {isPending ? "Menunggu Pembayaran" : "Booking Berhasil!"}
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {isPending
            ? "Pembayaran DP kamu sedang diproses. Cek email atau WhatsApp untuk instruksi selanjutnya."
            : "DP kamu sudah diterima. Sampai jumpa di lokasi!"}
        </p>

        {bookingId ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-[10px] text-gray-400 mb-1">ID Booking</p>
            <p className="text-xs font-mono font-bold text-gray-900">{bookingId}</p>
          </div>
        ) : null}

        <Link
          href={`/book/${slug}`}
          className="block w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-center"
        >
          Buat Booking Baru
        </Link>
      </div>
    </div>
  );
}
