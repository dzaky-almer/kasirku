"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PlanPageGate } from "@/components/PlanPageGate";
import { usePlanAccess } from "@/lib/use-plan-access";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDemoMode } from "@/lib/demo";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Shift {
  id: string;
  opening_cash: number;
  closing_cash?: number;
  total_sales: number;
  total_transactions: number;
  status: string;
  opened_at: string;
  closed_at?: string;
  notes?: string;
  cashierName?: string;
  user?: { name?: string; email?: string };
}

interface Summary {
  total_sales: number;
  total_transactions: number;
  avg_transaction: number;
  total_cash_in: number;
  total_diff: number;
}

type Mode = "harian" | "mingguan" | "bulanan" | "custom";

function fmt(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtFull(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function toInput(d: Date) {
  return d.toISOString().split("T")[0];
}

function getRange(mode: Mode): { from: string; to: string } {
  const today = new Date();
  if (mode === "harian") return { from: toInput(today), to: toInput(today) };
  if (mode === "mingguan") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + 1);
    return { from: toInput(mon), to: toInput(today) };
  }
  if (mode === "bulanan") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toInput(first), to: toInput(today) };
  }
  return { from: toInput(today), to: toInput(today) };
}

// Custom Tooltip — sama persis dengan Dashboard
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        fontSize: "12px",
        padding: "10px 14px",
      }}
    >
      <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>{label}</p>
      <p
        style={{
          color: "#f59e0b",
          margin: 0,
          fontWeight: 600,
          fontSize: "14px",
        }}
      >
        {fmtFull(payload[0].value as number)}
      </p>
    </div>
  );
};

export default function LaporanShiftPage() {
  const { data: session } = useSession();
  const { loading: planLoading, hasFeatureAccess } = usePlanAccess("laporan_shift");
  const { demoStoreId, isDemoMode } = useDemoMode();
  const storeId = isDemoMode
    ? demoStoreId
    : (session?.user as any)?.storeId ?? "";

  const [mode, setMode] = useState<Mode>("harian");
  const [dateFrom, setDateFrom] = useState(toInput(new Date()));
  const [dateTo, setDateTo] = useState(toInput(new Date()));
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "custom") {
      const r = getRange(mode);
      setDateFrom(r.from);
      setDateTo(r.to);
    }
  }, [mode]);

  useEffect(() => {
    if (!storeId) return;
    fetchReport();
  }, [storeId, dateFrom, dateTo]);

  async function fetchReport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/shifts/report?dateFrom=${dateFrom}&dateTo=${dateTo}&storeId=${storeId}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const rawShifts: Shift[] = data.shifts ?? [];
      setShifts(rawShifts);

      const total_sales = rawShifts.reduce((a, s) => a + s.total_sales, 0);
      const total_transactions = rawShifts.reduce(
        (a, s) => a + s.total_transactions,
        0
      );
      const total_cash_in = rawShifts.reduce(
        (a, s) => a + (s.closing_cash ?? 0),
        0
      );
      const total_diff = rawShifts.reduce((a, s) => {
        const expected = s.opening_cash + s.total_sales;
        return a + ((s.closing_cash ?? 0) - expected);
      }, 0);
      setSummary({
        total_sales,
        total_transactions,
        avg_transaction:
          total_transactions > 0
            ? Math.round(total_sales / total_transactions)
            : 0,
        total_cash_in,
        total_diff,
      });
    } catch {
      setError("Gagal memuat laporan shift.");
    } finally {
      setLoading(false);
    }
  }

  const allCashiers = Array.from(
    new Set(shifts.map((s) => (s.cashierName || "—").trim()))
  );

  const filtered = shifts.filter((s) => {
    const kasir = (s.cashierName || "—").toLowerCase();
    return (
      kasir.includes(search.toLowerCase()) &&
      (selectedUser === "all" || kasir === selectedUser.toLowerCase())
    );
  });

  const filteredSummary = {
    total_sales: filtered.reduce((a, s) => a + s.total_sales, 0),
    total_transactions: filtered.reduce((a, s) => a + s.total_transactions, 0),
    total_cash_in: filtered.reduce((a, s) => a + (s.closing_cash ?? 0), 0),
    total_diff: filtered.reduce((a, s) => a + shiftDiff(s), 0),
    get avg_transaction() {
      return this.total_transactions > 0
        ? Math.round(this.total_sales / this.total_transactions)
        : 0;
    },
  };

  const busiest =
    filtered.length > 0
      ? filtered.reduce((a, b) =>
          b.total_transactions > a.total_transactions ? b : a
        )
      : null;

  const bestKasir =
    filtered.length > 0
      ? filtered.reduce((a, b) => (b.total_sales > a.total_sales ? b : a))
      : null;

  // Data chart — setiap shift jadi satu titik di area chart
  const chartData = filtered.map((s, i) => ({
    name:
      (s.cashierName || `Shift ${i + 1}`).trim() +
      " · " +
      new Date(s.opened_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    omzet: s.total_sales,
  }));

  // Custom dot — naik hijau, turun merah, pertama amber (sama dengan Dashboard)
  const CustomDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    if (index === 0) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="#BA7517"
          stroke="#fff"
          strokeWidth={2.5}
        />
      );
    }
    const isUp = chartData[index].omzet >= chartData[index - 1].omzet;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={isUp ? "#16a34a" : "#dc2626"}
        stroke="#fff"
        strokeWidth={2.5}
      />
    );
  };

  function shiftDiff(s: Shift) {
    return (s.closing_cash ?? 0) - (s.opening_cash + s.total_sales);
  }
  function diffColor(diff: number) {
    if (Math.abs(diff) === 0) return "text-emerald-600";
    if (Math.abs(diff) < 10_000) return "text-orange-500";
    return "text-red-500";
  }
  function diffBg(diff: number) {
    if (Math.abs(diff) === 0) return "bg-emerald-50 text-emerald-700";
    if (Math.abs(diff) < 10_000) return "bg-orange-50 text-orange-600";
    return "bg-red-50 text-red-600";
  }

  function exportExcel() {
    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(
      filtered.map((s, i) => ({
        No: i + 1,
        Kasir: s.cashierName || "—",
        Buka: new Date(s.opened_at).toLocaleString("id-ID"),
        Tutup: s.closed_at
          ? new Date(s.closed_at).toLocaleString("id-ID")
          : "-",
        Status: s.status,
        "Opening Cash": s.opening_cash,
        "Total Sales": s.total_sales,
        Transaksi: s.total_transactions,
        "Closing Cash": s.closing_cash ?? 0,
        Selisih: shiftDiff(s),
      }))
    );
    utils.book_append_sheet(wb, ws1, "Shift");
    const ws2 = utils.json_to_sheet([
      { Metrik: "Total Omzet", Nilai: filteredSummary.total_sales },
      { Metrik: "Total Transaksi", Nilai: filteredSummary.total_transactions },
      {
        Metrik: "Rata-rata Transaksi",
        Nilai: filteredSummary.avg_transaction,
      },
      { Metrik: "Total Cash Masuk", Nilai: filteredSummary.total_cash_in },
      { Metrik: "Total Selisih", Nilai: filteredSummary.total_diff },
    ]);
    utils.book_append_sheet(wb, ws2, "Summary");
    writeFile(wb, `LaporanShift_${dateFrom}_${dateTo}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    const periode =
      dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;
    doc.setFontSize(13);
    doc.text("Laporan Shift Kasir", 14, 15);
    doc.setFontSize(9);
    doc.text(`Periode: ${periode}`, 14, 22);
    autoTable(doc, {
      head: [["Metrik", "Nilai"]],
      body: [
        ["Total Omzet", fmtFull(filteredSummary.total_sales)],
        ["Total Transaksi", String(filteredSummary.total_transactions)],
        ["Rata-rata Transaksi", fmtFull(filteredSummary.avg_transaction)],
        ["Total Cash Masuk", fmtFull(filteredSummary.total_cash_in)],
        ["Total Selisih", fmtFull(filteredSummary.total_diff)],
      ],
      startY: 27,
      theme: "grid",
      headStyles: { fillColor: [146, 64, 14] },
      styles: { fontSize: 9 },
      tableWidth: 90,
    });
    autoTable(doc, {
      head: [["No", "Kasir", "Buka", "Tutup", "Trx", "Sales", "Selisih"]],
      body: filtered.map((s, i) => [
        i + 1,
        s.cashierName || "—",
        new Date(s.opened_at).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        s.closed_at
          ? new Date(s.closed_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
        s.total_transactions,
        fmtFull(s.total_sales),
        fmtFull(shiftDiff(s)),
      ]),
      startY: (doc as any).lastAutoTable
        ? (doc as any).lastAutoTable.finalY + 8
        : 60,
      theme: "grid",
      headStyles: { fillColor: [146, 64, 14] },
      styles: { fontSize: 8 },
    });
    doc.save(`LaporanShift_${dateFrom}_${dateTo}.pdf`);
  }

  const MODES: { key: Mode; label: string }[] = [
    { key: "harian", label: "Harian" },
    { key: "mingguan", label: "Mingguan" },
    { key: "bulanan", label: "Bulanan" },
    { key: "custom", label: "Custom" },
  ];

  if (planLoading) return <PlanPageGate feature="laporan_shift" featureName="Laporan Shift" />;
  if (!hasFeatureAccess) return <PlanPageGate feature="laporan_shift" featureName="Laporan Shift" />;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Laporan Shift</span>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              disabled={filtered.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              Export Excel
            </button>
            <button
              onClick={exportPDF}
              disabled={filtered.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              Export PDF
            </button>
          </div>
        </header>

        {/* FILTER BAR */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === m.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-xs text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={dateTo}
                max={toInput(new Date())}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-xs text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
              />
            </div>
          ) : (
            <span className="text-xs text-gray-500">
              {dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}
            </span>
          )}

          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-1.5 text-xs text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 bg-white"
          >
            <option value="all">Semua Kasir</option>
            {allCashiers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <div className="relative ml-auto">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
              viewBox="0 0 16 16"
              fill="none"
              strokeWidth={1.5}
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Cari kasir..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs text-black bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 w-40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ERROR */}
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* SKELETON LOADING */}
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse"
                >
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                      <div className="h-2 w-32 bg-gray-100 rounded" />
                    </div>
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && summary && (
            <>
              {/* METRIC CARDS */}
              <div className="grid grid-cols-5 gap-3 ">
                {[
                  {
                    label: "Total omzet",
                    value: fmt(filteredSummary.total_sales),
                    sub: "periode ini",
                  },
                  {
                    label: "Total transaksi",
                    value: filteredSummary.total_transactions,
                    sub: "transaksi",
                  },
                  {
                    label: "Rata-rata transaksi",
                    value: fmt(filteredSummary.avg_transaction),
                    sub: "per transaksi",
                  },
                  {
                    label: "Total cash masuk",
                    value: fmt(filteredSummary.total_cash_in),
                    sub: "closing cash",
                  },
                  {
                    label: "Total selisih",
                    value:
                      (filteredSummary.total_diff >= 0 ? "+" : "") +
                      fmt(filteredSummary.total_diff),
                    sub: "semua shift",
                    accent:
                      filteredSummary.total_diff < 0
                        ? "text-red-500"
                        : "text-emerald-600",
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-[0_0_10px_rgba(0,0,0,0.20)] hover:shadow-[0_0_15px_rgba(0,0,0,0.25)] transition-shadow"
                  >
                    <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                    <p
                      className={`text-lg font-medium ${
                        (c as any).accent ?? "text-gray-900"
                      }`}
                    >
                      {c.value}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* CHART AREA + INSIGHT */}
              <div className="grid grid-cols-3 gap-3">

                {/* AreaChart — pengganti bar chart lama */}
                <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-[0_0_10px_rgba(0,0,0,0.20)] hover:shadow-[0_0_15px_rgba(0,0,0,0.25)] transition-shadow">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-medium text-gray-400 tracking-wider">
                      PENJUALAN PER SHIFT
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
                        Naik
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                        Turun
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-amber-700 inline-block" />
                        Awal
                      </span>
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 py-8 text-center">
                      Tidak ada data.
                    </p>
                  ) : (
                    <div className="w-full h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="shiftOmzetFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#f59e0b"
                                stopOpacity={0.5}
                              />
                              <stop
                                offset="60%"
                                stopColor="#BA7517"
                                stopOpacity={0.15}
                              />
                              <stop
                                offset="100%"
                                stopColor="#BA7517"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="rgba(0,0,0,0.05)"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="name"
                            fontSize={9}
                            tick={{ fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            tickFormatter={(v: string) =>
                              v.split(" · ")[1] ?? v
                            }
                          />

                          <YAxis
                            fontSize={10}
                            tick={{ fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => fmt(v)}
                            width={64}
                          />

                          <Tooltip
                            content={<CustomTooltip />}
                            cursor={{
                              stroke: "rgba(186,117,23,0.25)",
                              strokeWidth: 1,
                              strokeDasharray: "4 4",
                            }}
                          />

                          <Area
                            type="monotone"
                            dataKey="omzet"
                            stroke="#BA7517"
                            strokeWidth={2.5}
                            fill="url(#shiftOmzetFill)"
                            dot={<CustomDot />}
                            activeDot={{
                              r: 7,
                              fill: "#f59e0b",
                              stroke: "#fff",
                              strokeWidth: 2.5,
                            }}
                            isAnimationActive={true}
                            animationDuration={900}
                            animationEasing="ease-out"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* INSIGHT — tidak berubah */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3 shadow-[0_0_10px_rgba(0,0,0,0.20)] hover:shadow-[0_0_15px_rgba(0,0,0,0.25)] transition-shadow">
                  <p className="text-xs font-medium text-gray-400 tracking-wider">
                    INSIGHT OTOMATIS
                  </p>
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400">Belum ada data.</p>
                  ) : (
                    <>
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <p className="text-[10px] text-amber-700 font-medium mb-0.5">
                          Shift Paling Ramai
                        </p>
                        <p className="text-xs text-gray-800 font-medium">
                          {busiest?.cashierName ?? "—"}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {busiest?.total_transactions} transaksi ·{" "}
                          {new Date(busiest!.opened_at).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-[10px] text-emerald-700 font-medium mb-0.5">
                          Kasir Terbaik
                        </p>
                        <p className="text-xs text-gray-800 font-medium">
                          {bestKasir?.cashierName ?? "—"}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {fmt(bestKasir?.total_sales ?? 0)} omzet
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-lg ${
                          filteredSummary.total_diff < -50_000
                            ? "bg-red-50"
                            : "bg-gray-50"
                        }`}
                      >
                        <p
                          className={`text-[10px] font-medium mb-0.5 ${
                            filteredSummary.total_diff < -50_000
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >
                          {filteredSummary.total_diff < -50_000
                            ? "⚠ Selisih Besar"
                            : "Selisih Kas"}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            filteredSummary.total_diff < 0
                              ? "text-red-500"
                              : "text-emerald-600"
                          }`}
                        >
                          {filteredSummary.total_diff >= 0 ? "+" : ""}
                          {fmtFull(filteredSummary.total_diff)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          total semua shift
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* LIST SHIFT */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.20)] hover:shadow-[0_0_15px_rgba(0,0,0,0.25)] transition-shadow">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-400 tracking-wider">
                    DAFTAR SHIFT
                  </p>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10">
                    Tidak ada shift ditemukan.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map((s) => {
                      const diff = shiftDiff(s);
                      const kasir =
                        (s.cashierName || "Kasir").trim() || "Kasir";
                      const buka = new Date(s.opened_at).toLocaleTimeString(
                        "id-ID",
                        { hour: "2-digit", minute: "2-digit" }
                      );
                      const tutup = s.closed_at
                        ? new Date(s.closed_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-";
                      const isOpen = s.status === "OPEN";
                      const expanded = expandedId === s.id;

                      return (
                        <div key={s.id}>
                          <div
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() =>
                              setExpandedId(expanded ? null : s.id)
                            }
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  isOpen ? "bg-emerald-500" : "bg-gray-300"
                                }`}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-800">
                                    {kasir}
                                  </p>
                                  {isOpen && (
                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                      Aktif
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  {buka} — {tutup}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] text-gray-400">
                                  Transaksi
                                </p>
                                <p className="text-xs font-medium text-amber-700">
                                  {s.total_transactions}
                                </p>
                              </div>
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] text-gray-400">
                                  Sales
                                </p>
                                <p className="text-xs font-medium text-gray-800">
                                  {fmt(s.total_sales)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400">
                                  Selisih
                                </p>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${diffBg(diff)}`}
                                >
                                  {diff >= 0 ? "+" : ""}
                                  {fmt(diff)}
                                </span>
                              </div>
                              <svg
                                viewBox="0 0 16 16"
                                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                                  expanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                strokeWidth={1.5}
                              >
                                <path
                                  d="M4 6l4 4 4-4"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>

                          {expanded && (
                            <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-medium text-gray-400 tracking-wider">
                                    INFO KAS
                                  </p>
                                  {[
                                    ["Opening Cash", fmtFull(s.opening_cash)],
                                    ["Total Sales", fmtFull(s.total_sales)],
                                    [
                                      "Expected Cash",
                                      fmtFull(s.opening_cash + s.total_sales),
                                    ],
                                    [
                                      "Closing Cash",
                                      s.closing_cash != null
                                        ? fmtFull(s.closing_cash)
                                        : "—",
                                    ],
                                    [
                                      "Selisih",
                                      (diff >= 0 ? "+" : "") + fmtFull(diff),
                                    ],
                                  ].map(([label, val]) => (
                                    <div
                                      key={label}
                                      className="flex justify-between"
                                    >
                                      <span className="text-xs text-gray-500">
                                        {label}
                                      </span>
                                      <span
                                        className={`text-xs font-medium ${
                                          label === "Selisih"
                                            ? diffColor(diff)
                                            : "text-gray-800"
                                        }`}
                                      >
                                        {val}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-medium text-gray-400 tracking-wider">
                                    INFO SHIFT
                                  </p>
                                  {[
                                    ["Status", isOpen ? "Aktif" : "Selesai"],
                                    ["Kasir", kasir],
                                    ["Dibuka", buka],
                                    ["Ditutup", tutup],
                                    [
                                      "Total Transaksi",
                                      String(s.total_transactions),
                                    ],
                                  ].map(([label, val]) => (
                                    <div
                                      key={label}
                                      className="flex justify-between"
                                    >
                                      <span className="text-xs text-gray-500">
                                        {label}
                                      </span>
                                      <span className="text-xs font-medium text-gray-800">
                                        {val}
                                      </span>
                                    </div>
                                  ))}
                                  {s.notes && (
                                    <div>
                                      <span className="text-xs text-gray-500">
                                        Catatan
                                      </span>
                                      <p className="text-xs text-gray-700 mt-0.5 italic">
                                        "{s.notes}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* EMPTY STATE */}
          {!loading && !error && shifts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">
                Tidak ada shift pada periode ini.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Coba ubah rentang tanggal.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
