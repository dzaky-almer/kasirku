"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";

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
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [closingCash, setClosingCash] = useState<number | null>(null);
  const [closingCashInput, setClosingCashInput] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 FORMATTER
  const formatInputRupiah = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    return new Intl.NumberFormat("id-ID").format(Number(cleaned));
  };

  const parseRupiah = (value: string) => {
    return Number(value.replace(/\./g, "")) || 0;
  };

  // 🔥 FETCH SHIFT AKTIF
  const fetchShift = async () => {
    try {
      const activeStoreId = isDemoMode
        ? demoStoreId
        : (session?.user as any)?.storeId ?? "";

      if (!activeStoreId) return;

      const res = await fetch(
        `/api/shifts/current?storeId=${encodeURIComponent(activeStoreId)}`
      );
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
    const storeId = isDemoMode
      ? demoStoreId
      : (session?.user as any)?.storeId ?? "";

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
        cashierName,
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
    setOpeningCashInput("");
    setCashierName("");
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
    setClosingCashInput("");
    setNotes("");
  };

  function formatRupiah(amount: number) {
    if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
    if (amount >= 1000) return `Rp ${Math.round(amount / 1000)}rb`;
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }

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
            <Card label="Uang awal" value={openShift ? formatRupiah(openShift.opening_cash) : "—"} />
            <Card label="Total penjualan" value={openShift ? formatRupiah(openShift.total_sales) : "—"} highlight />
            <Card label="Expected cash" value={openShift ? formatRupiah(expected) : "—"} />
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
                type="text"
                placeholder="Uang awal"
                value={openingCashInput}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 text-black"
                onChange={(e) => {
                  const formatted = formatInputRupiah(e.target.value);
                  setOpeningCashInput(formatted);
                  setOpeningCash(parseRupiah(formatted));
                }}
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

              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <InfoRow label="Kasir" value={openShift.cashierName || "—"} />
                <InfoRow label="Dibuka" value={getOpenTime()} />
                <InfoRow label="Transaksi" value={`${openShift.total_transactions ?? 0}`} />
                <InfoRow label="Expected" value={formatRupiah(expected)} />
              </div>

              <div className="bg-white text-black rounded-xl border border-gray-100 p-5">
                <input
                  type="text"
                  placeholder="Uang akhir"
                  value={closingCashInput}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
                  onChange={(e) => {
                    const formatted = formatInputRupiah(e.target.value);
                    setClosingCashInput(formatted);
                    setClosingCash(parseRupiah(formatted));
                  }}
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
                    {diff === null ? "-" : formatRupiah(diff)}
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