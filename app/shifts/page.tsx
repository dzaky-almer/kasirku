"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";
import { formatRupiahShort } from "@/lib/currency";

interface Shift {
  id: string;
  opening_cash: number;
  total_sales: number;
  total_transactions?: number;
  opened_at?: string;
  cashierName?: string;
}

export default function ShiftsPage() {
  const { data: session, status } = useSession();
  const { demoStoreId, demoUserId, isDemoMode } = useDemoMode();

  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [cashierName, setCashierName] = useState(""); 
  const [closingCash, setClosingCash] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 FETCH SHIFT AKTIF
  const fetchShift = async () => {
    try {
      const activeStoreId = isDemoMode ? demoStoreId : (session?.user as any)?.storeId ?? "";
      if (!activeStoreId) return;
      const res = await fetch(`/api/shifts/current?storeId=${encodeURIComponent(activeStoreId ?? "")}`);
      const data = await res.json();
      setOpenShift(data?.id ? data : null);
    } catch (err) {
      console.error("Fetch shift error:", err);
    }
  };

  useEffect(() => {
    if ((status === "authenticated" && !isDemoMode) || demoStoreId) {
      fetchShift();
    }
  }, [status, demoStoreId, isDemoMode, session]);

  // 🟢 OPEN SHIFT
  const handleOpenShift = async () => {
    const userId = isDemoMode ? demoUserId : session?.user?.id ?? "";
    const storeId = isDemoMode ? demoStoreId : (session?.user as any)?.storeId ?? "";

    if (!userId || !storeId) {
      alert("Session belum siap 😭");
      return;
    }

    if (!cashierName) {
      alert("Nama kasir wajib diisi");
      return;
    }

    if (openingCash <= 0) {
      alert("Uang awal harus diisi");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opening_cash: openingCash,
        cashierName, // ✅ dari input manual
        userId,
        storeId,
      }),
    });

    const data = await res.json().catch(() => null);

    setLoading(false);

    if (!res.ok) {
      alert(data?.error || "Gagal buka shift");
      return;
    }

    setOpenShift(data);
    setOpeningCash(0);
    setCashierName(""); // reset input
  };

  // 🔴 CLOSE SHIFT
  const handleCloseShift = async () => {
    if (!openShift) return;

    if (closingCash === null) {
      alert("Isi uang akhir dulu");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shiftId: openShift.id,
        closing_cash: closingCash,
        notes,
      }),
    });

    const data = await res.json().catch(() => null);

    setLoading(false);

    if (!res.ok) {
      alert(data?.error || "Gagal tutup shift");
      return;
    }

    setOpenShift(null);
    setClosingCash(null);
    setNotes("");
  };

  function getOpenTime() {
    if (!openShift?.opened_at) return "—";
    return new Date(openShift.opened_at).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const expected =
    (openShift?.opening_cash ?? 0) +
    (openShift?.total_sales ?? 0);

  const diff =
    closingCash !== null ? closingCash - expected : null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            Shift Kasir
          </span>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1 rounded-full ${
                openShift
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {openShift ? "Shift aktif" : "Tidak ada shift"}
            </span>

            {/* ✅ tampil nama kasir aktif */}
            {openShift && (
              <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                👤 {openShift.cashierName || "Kasir"}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* METRIC */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Card label="Uang awal" value={openShift ? formatRupiahShort(openShift.opening_cash) : "—"} />
            <Card label="Total penjualan" value={openShift ? formatRupiahShort(openShift.total_sales) : "—"} highlight />
            <Card label="Expected cash" value={openShift ? formatRupiahShort(expected) : "—"} />
          </div>

          {/* OPEN SHIFT */}
          {!openShift && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 max-w-sm">
              <p className="text-xs font-medium text-gray-400 mb-4">
                BUKA SHIFT
              </p>

              <input
                type="text"
                placeholder="Nama"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 text-black"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
              />

              <input
                type="number"
                placeholder="Uang awal"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 text-black"
                onChange={(e) =>
                  setOpeningCash(Number(e.target.value) || 0)
                }
              />

              <button
                onClick={handleOpenShift}
                disabled={loading}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm py-2.5 rounded-lg"
              >
                {loading ? "Memproses..." : "Buka shift"}
              </button>
            </div>
          )}

          {/* SHIFT AKTIF */}
          {openShift && (
            <div className="grid grid-cols-2 gap-4">

              {/* INFO */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <InfoRow label="Kasir" value={openShift.cashierName || "—"} />
                <InfoRow label="Dibuka" value={getOpenTime()} />
                <InfoRow label="Transaksi" value={`${openShift.total_transactions ?? 0}`} />
                <InfoRow label="Expected" value={formatRupiahShort(expected)} />
              </div>

              {/* CLOSE */}
              <div className="bg-white text-black rounded-xl border border-gray-100 p-5">
                <input
                  type="number"
                  placeholder="Uang akhir"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
                  onChange={(e) =>
                    setClosingCash(
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />

                <textarea
                  placeholder="Catatan..."
                  className="w-full text-black bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="mb-4 text-sm text-black">
                  Selisih:{" "}
                  <span
                    className={
                      diff === null
                        ? "text-gray-400"
                        : diff < 0
                        ? "text-red-500"
                        : "text-emerald-600"
                    }
                  >
                    {diff === null ? "-" : formatRupiahShort(diff)}
                  </span>
                </div>

                <button
                  onClick={handleCloseShift}
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white text-sm py-2.5 rounded-lg"
                >
                  {loading ? "Memproses..." : "Tutup shift"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// 🔹 COMPONENT
function Card({ label, value, highlight }: any) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-medium ${highlight ? "text-emerald-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: any) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
