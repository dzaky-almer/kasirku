"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Shift {
  id: string;
  opening_cash: number;
  total_sales: number;
  total_transactions?: number;
  createdAt?: string;
}

export default function ShiftsPage() {
  const { data: session } = useSession();
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [closingCash, setClosingCash] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const fetchShift = async () => {
    const res = await fetch("/api/shifts/current");
    const data = await res.json();
    setOpenShift(data?.id ? data : null);
  };

  useEffect(() => {
    fetchShift();
  }, []);

  const handleOpenShift = async () => {
    const userId = session?.user?.id;
    const storeId = (session?.user as any)?.storeId;

    if (!userId || !storeId) {
      alert("Session belum siap 😭");
      return;
    }

    const res = await fetch("/api/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opening_cash: openingCash, userId, storeId }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      alert(data?.error || "Gagal buka shift");
      return;
    }

    setOpenShift(data);
  };

  const handleCloseShift = async () => {
    if (!openShift) return;

    const res = await fetch("/api/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      shiftId: openShift.id,
      closing_cash: closingCash ?? 0,
      notes,
    }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Gagal tutup shift");
      return;
    }

    setOpenShift(null);
    setClosingCash(0);
    setNotes("");
  };

  function formatRupiah(amount: number): string {
    if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
    if (amount >= 1000) return `Rp ${Math.round(amount / 1000)}rb`;
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }

  function getOpenTime(): string {
    if (!openShift?.createdAt) return "—";
    return new Date(openShift.createdAt).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const expected = (openShift?.opening_cash ?? 0) + (openShift?.total_sales ?? 0);
const diff = closingCash !== null ? closingCash - expected : null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Shift Kasir</span>
          <div className="flex items-center gap-2">
            {openShift ? (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                Shift aktif
              </span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                Tidak ada shift aktif
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {(session?.user as any)?.email ?? "Kasir"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* METRIC CARDS — selalu tampil */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Uang awal</p>
              <p className="text-xl font-medium text-gray-900">
                {openShift ? formatRupiah(openShift.opening_cash) : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">modal shift ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Total penjualan</p>
              <p className="text-xl font-medium text-emerald-600">
                {openShift ? formatRupiah(openShift.total_sales) : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">dari transaksi shift ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Expected cash</p>
              <p className="text-xl font-medium text-gray-900">
                {openShift ? formatRupiah(expected) : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">modal + penjualan</p>
            </div>
          </div>

          {/* BUKA SHIFT */}
          {!openShift && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 max-w-sm">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                BUKA SHIFT
              </p>
              <label className="text-xs text-gray-500 mb-1 block">Uang awal (Rp)</label>
              <input
                type="number"
                placeholder="0"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 mb-4"
                onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
              />
              <button
                onClick={handleOpenShift}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Buka shift
              </button>
            </div>
          )}

          {/* SHIFT AKTIF */}
          {openShift && (
            <div className="grid grid-cols-2 gap-4">

              {/* INFO SHIFT */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                  INFO SHIFT AKTIF
                </p>
                <div className="divide-y divide-gray-50">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Dibuka pukul</span>
                    <span className="text-xs font-medium text-gray-900">{getOpenTime()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Uang awal</span>
                    <span className="text-xs font-medium text-gray-900">
                      {formatRupiah(openShift.opening_cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Total penjualan</span>
                    <span className="text-xs font-medium text-emerald-600">
                      +{formatRupiah(openShift.total_sales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Transaksi</span>
                    <span className="text-xs font-medium text-amber-700">
                      {openShift.total_transactions ?? 0} transaksi
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Expected cash</span>
                    <span className="text-xs font-medium text-gray-900">
                      {formatRupiah(expected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-gray-500">Status</span>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                      Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* TUTUP SHIFT */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                  TUTUP SHIFT
                </p>

                <label className="text-xs text-gray-500 mb-1 block">Uang akhir (Rp)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 mb-3"
                  onChange={(e) => setClosingCash(e.target.value === "" ? null : Number(e.target.value))}
                />

                <label className="text-xs text-gray-500 mb-1 block">Catatan</label>
                <textarea
                  placeholder="Catatan opsional..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 mb-3 resize-none"
                  onChange={(e) => setNotes(e.target.value)}
                />

                {/* SELISIH */}
                <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500">Selisih</span>
                  {diff === null ? (
                    <span className="text-xs text-gray-400">Isi uang akhir dulu</span>
                  ) : (
                    <span className={`text-sm font-medium ${diff < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatRupiah(diff)}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleCloseShift}
                  className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Tutup shift
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}