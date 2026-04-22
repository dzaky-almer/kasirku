"use client";

import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";

export default function BookingSuccessPage() {
    const { slug } = useParams<{ slug: string }>();
    const params = useSearchParams();
    const bookingId = params.get("id");
    const status = params.get("status"); // "pending" | null (= success)

    const isPending = status === "pending";

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-sm w-full text-center">
                {/* Icon */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl ${isPending ? "bg-amber-100" : "bg-emerald-100"}`}>
                    {isPending ? "⏳" : "✅"}
                </div>

                <h1 className="text-xl font-black text-gray-900 mb-2">
                    {isPending ? "Menunggu Pembayaran" : "Booking Berhasil!"}
                </h1>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    {isPending
                        ? "Pembayaran DP kamu sedang diproses. Cek email atau WhatsApp untuk instruksi selanjutnya."
                        : "DP kamu sudah diterima. Sampai jumpa di lokasi!"}
                </p>

                {/* Booking ID */}
                {bookingId && (
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-6">
                        <p className="text-[10px] text-gray-400 mb-1">ID Booking</p>
                        <p className="text-xs font-mono font-bold text-gray-900">{bookingId}</p>
                    </div>
                )}

                {/* Info box */}
                <div className={`rounded-xl p-4 mb-6 text-left ${isPending ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                    <p className={`text-xs font-semibold mb-2 ${isPending ? "text-amber-800" : "text-emerald-800"}`}>
                        {isPending ? "📋 Yang perlu dilakukan:" : "📋 Informasi penting:"}
                    </p>
                    {isPending ? (
                        <ul className="text-xs text-amber-700 space-y-1">
                            <li>• Selesaikan pembayaran sesuai instruksi</li>
                            <li>• Booking akan dikonfirmasi otomatis setelah pembayaran diterima</li>
                            <li>• Simpan ID booking kamu di atas</li>
                        </ul>
                    ) : (
                        <ul className="text-xs text-emerald-700 space-y-1">
                            <li>• Datanglah tepat waktu sesuai slot yang dipilih</li>
                            <li>• Tunjukkan ID booking di atas ke kasir</li>
                            <li>• DP tidak dapat dikembalikan jika tidak hadir</li>
                        </ul>
                    )}
                </div>

                <Link href={`/book/${slug}`}
                    className="block w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-center">
                    Buat Booking Baru
                </Link>
            </div>
        </div>
    );
}