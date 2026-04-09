"use client";

import { useState } from "react";

function formatRupiah(amount: number) {
  return "Rp " + amount.toLocaleString("id-ID");
}

function getToday() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function LaporanPage() {
  const [date, setDate] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(`/api/shifts/report?date=${date}`);
    const result = await res.json();
    setData(result);
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER (SAMA STYLE DASHBOARD) */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            Laporan Shift
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
            {getToday()}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* FILTER */}
          <div className="flex gap-2 mb-5">
            <input
              type="date"
              className="border border-gray-200 px-3 py-2 rounded-lg text-sm"
              onChange={(e) => setDate(e.target.value)}
            />

            <button
              onClick={fetchReport}
              className="bg-amber-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-800"
            >
              Tampilkan
            </button>
          </div>

          {/* LOADING */}
          {loading && (
            <p className="text-xs text-gray-400">Memuat laporan...</p>
          )}

          {/* DATA */}
          {data && (
            <>
              {/* 🔥 METRIC CARDS (SAMA KAYAK DASHBOARD) */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Total Sales</p>
                  <p className="text-lg font-medium text-gray-900">
                    {formatRupiah(data.summary.total_sales)}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Total Transaksi</p>
                  <p className="text-lg font-medium text-gray-900">
                    {data.summary.total_transactions}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Jumlah Shift</p>
                  <p className="text-lg font-medium text-gray-900">
                    {data.shifts.length}
                  </p>
                </div>
              </div>

              {/* 🔥 LIST SHIFT */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
                  SHIFT HARI INI
                </p>

                {data.shifts.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Tidak ada shift di tanggal ini.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {data.shifts.map((s: any, i: number) => {
                      const diff =
                        (s.closing_cash || 0) -
                        (s.opening_cash + s.total_sales);

                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between py-3"
                        >
                          {/* LEFT */}
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />

                            <div>
                              <p className="text-sm text-gray-800">
                                {s.user?.name || "Kasir"}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(s.opened_at).toLocaleTimeString("id-ID")} -{" "}
                                {s.closed_at
                                  ? new Date(s.closed_at).toLocaleTimeString("id-ID")
                                  : "-"}
                              </p>
                            </div>
                          </div>

                          {/* RIGHT */}
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {s.total_transactions} trx
                            </p>

                            <p className="text-sm font-medium text-gray-900">
                              {formatRupiah(s.total_sales)}
                            </p>

                            <p
                              className={`text-xs ${
                                diff < 0 ? "text-red-500" : "text-green-600"
                              }`}
                            >
                              {diff >= 0 ? "+" : ""}
                              {formatRupiah(diff)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}