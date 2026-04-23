"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_38%,_#f8fafc)]" />}>
      <BookingSuccessContent />
    </Suspense>
  );
}

function BookingSuccessContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");
  const status = searchParams.get("status");
  const pending = status === "pending";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_38%,_#f8fafc)] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl ${pending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
          {pending ? "!" : "OK"}
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          {pending ? "Pembayaran masih pending" : "Booking berhasil dibuat"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {pending
            ? "Booking sudah tercatat. Selesaikan pembayaran DP agar status booking berubah menjadi terkonfirmasi."
            : "DP sudah diproses dan booking kamu sudah masuk ke sistem. Tunjukkan ID booking ini jika diperlukan saat datang."}
        </p>

        {bookingId ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Booking ID</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-950">{bookingId}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href={`/book/${slug}`} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Buat booking baru
          </Link>
          <Link href="/home" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            Kembali ke home
          </Link>
        </div>
      </div>
    </div>
  );
}
