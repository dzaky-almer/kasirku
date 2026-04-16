"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDemoMode } from "@/lib/demo";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TxnItem {
  productId: string;
  qty: number;
  price: number;
  product?: { name: string };
}
interface Transaction {
  id: string;
  total: number;
  createdAt: string;
  items: TxnItem[];
}
interface Summary {
  totalRevenue: number;
  totalTransactions: number;
  totalItems: number;
  avgTransaction: number;
}
interface TopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}
interface DailyChart {
  date: string;
  revenue: number;
  transactions: number;
}
interface HourChart {
  hour: number;
  label: string;
  count: number;
}

type Mode = "harian" | "mingguan" | "bulanan" | "custom";

function fmt(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function fmtFull(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function toInput(d: Date) {
  return d.toISOString().split("T")[0];
}

// ── Custom Tooltip untuk AreaChart ─────────────────────────────
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
        {fmt(payload[0].value as number)}
      </p>
    </div>
  );
};

// ── Peak Hour Chart (Recharts) ─────────────────────────────────
function PeakHourChart({ data }: { data: HourChart[] }) {
  if (!data.length) return null;

  const peakIdx = data.reduce(
    (best, h, i) => (h.count > data[best].count ? i : best),
    0
  );

  const CustomBar = (props: any) => {
    const { x, y, width, height, index } = props;
    if (!width || !height) return null;
    const isPeak = index === peakIdx;
    const isEmpty = data[index].count === 0;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={4}
          ry={4}
          fill={isEmpty ? "transparent" : isPeak ? "#BA7517" : "#FAEEDA"}
        />
        {isPeak && !isEmpty && (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={4}
            ry={4}
            fill="url(#peakGlow)"
          />
        )}
      </g>
    );
  };

  const PeakTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
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
          {payload[0].value} transaksi
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data.map((h) => ({
          ...h,
          label: `${String(h.hour).padStart(2, "0")}:00`,
        }))}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        barCategoryGap="20%"
      >
        <defs>
          <linearGradient id="peakGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(0,0,0,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          fontSize={10}
          tick={{ fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis
          fontSize={10}
          tick={{ fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          content={<PeakTooltip />}
          cursor={{ fill: "rgba(186,117,23,0.06)" }}
        />
        <Bar
          dataKey="count"
          shape={<CustomBar />}
          maxBarSize={32}
          isAnimationActive
          animationDuration={700}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function LaporanPage() {
  const { data: session, status } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();
  const storeId = isDemoMode
    ? demoStoreId
    : (session?.user as any)?.storeId ?? "";

  const [mode, setMode] = useState<Mode>("harian");
  const [dateFrom, setDateFrom] = useState(toInput(new Date()));
  const [dateTo, setDateTo] = useState(toInput(new Date()));

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyChart, setDailyChart] = useState<DailyChart[]>([]);
  const [hourChart, setHourChart] = useState<HourChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date();
    if (mode === "harian") {
      setDateFrom(toInput(today));
      setDateTo(toInput(today));
    } else if (mode === "mingguan") {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay() + 1);
      setDateFrom(toInput(mon));
      setDateTo(toInput(today));
    } else if (mode === "bulanan") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toInput(first));
      setDateTo(toInput(today));
    }
  }, [mode]);

  useEffect(() => {
    if (status === "loading" || !storeId) return;
    fetchLaporan();
  }, [storeId, status, dateFrom, dateTo]);

  async function fetchLaporan() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports?storeId=${storeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setSummary(data.summary ?? null);
      setTopProducts(data.topProducts ?? []);
      setDailyChart(data.dailyChart ?? []);
      setHourChart(data.hourChart ?? []);
    } catch {
      setError("Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  function buildRows() {
    let no = 1;
    return transactions.flatMap((trx) =>
      trx.items.map((item) => ({
        no: no++,
        waktu: new Date(trx.createdAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tanggal: new Date(trx.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
        idTrx: trx.id.slice(0, 8),
        namaProduk: item.product?.name ?? "-",
        qty: item.qty,
        harga: item.price,
        subtotal: item.qty * item.price,
      }))
    );
  }

  function exportExcel() {
    const rows = buildRows();
    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(
      rows.map((r) => ({
        No: r.no,
        Tanggal: r.tanggal,
        Waktu: r.waktu,
        "ID Transaksi": r.idTrx,
        "Nama Produk": r.namaProduk,
        Qty: r.qty,
        "Harga Satuan": r.harga,
        Subtotal: r.subtotal,
      }))
    );
    utils.book_append_sheet(wb, ws1, "Transaksi");
    const ws2 = utils.json_to_sheet([
      { Metrik: "Total Omzet", Nilai: summary?.totalRevenue ?? 0 },
      { Metrik: "Total Transaksi", Nilai: summary?.totalTransactions ?? 0 },
      { Metrik: "Total Item Terjual", Nilai: summary?.totalItems ?? 0 },
      { Metrik: "Rata-rata Transaksi", Nilai: summary?.avgTransaction ?? 0 },
    ]);
    utils.book_append_sheet(wb, ws2, "Summary");
    const ws3 = utils.json_to_sheet(
      topProducts.map((p, i) => ({
        Rank: i + 1,
        Produk: p.name,
        "Qty Terjual": p.qty,
        Omzet: p.revenue,
      }))
    );
    utils.book_append_sheet(wb, ws3, "Top Produk");
    writeFile(wb, `Laporan_${dateFrom}_${dateTo}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    const periode =
      dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;
    doc.setFontSize(14);
    doc.text("Laporan Penjualan", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${periode}`, 14, 22);
    if (summary) {
      autoTable(doc, {
        head: [["Metrik", "Nilai"]],
        body: [
          ["Total Omzet", fmtFull(summary.totalRevenue)],
          ["Total Transaksi", String(summary.totalTransactions)],
          ["Total Item", String(summary.totalItems)],
          ["Rata-rata Transaksi", fmtFull(summary.avgTransaction)],
        ],
        startY: 27,
        theme: "grid",
        headStyles: { fillColor: [146, 64, 14] },
        styles: { fontSize: 9 },
        tableWidth: 90,
      });
    }
    if (topProducts.length > 0) {
      autoTable(doc, {
        head: [["Rank", "Produk", "Qty", "Omzet"]],
        body: topProducts.map((p, i) => [
          i + 1,
          p.name,
          p.qty,
          fmtFull(p.revenue),
        ]),
        startY: (doc as any).lastAutoTable.finalY + 8,
        theme: "grid",
        headStyles: { fillColor: [146, 64, 14] },
        styles: { fontSize: 9 },
        tableWidth: 90,
      });
    }
    autoTable(doc, {
      head: [
        ["No", "Tgl", "Waktu", "ID Trx", "Produk", "Qty", "Harga", "Subtotal"],
      ],
      body: buildRows().map((r) => [
        r.no,
        r.tanggal,
        r.waktu,
        r.idTrx + "...",
        r.namaProduk,
        r.qty,
        fmtFull(r.harga),
        fmtFull(r.subtotal),
      ]),
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "grid",
      headStyles: { fillColor: [146, 64, 14] },
      styles: { fontSize: 8 },
    });
    doc.save(`Laporan_${dateFrom}_${dateTo}.pdf`);
  }

  const rows = buildRows();

  // ── Chart data untuk Recharts ──────────────────────────────────
  const chartData = dailyChart.map((d) => ({
    name: new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    }),
    omzet: d.revenue,
  }));

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

  // Peak hour info
  const peakHour =
    hourChart.length > 0
      ? hourChart.reduce((best, h) => (h.count > best.count ? h : best))
      : null;

  const MODES: { key: Mode; label: string }[] = [
    { key: "harian", label: "Harian" },
    { key: "mingguan", label: "Mingguan" },
    { key: "bulanan", label: "Bulanan" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">
            Laporan Penjualan
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Export Excel
            </button>
            <button
              onClick={exportPDF}
              disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                    : "text-gray-500 hover:text-gray-700"
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
                className="px-3 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-amber-400"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={dateTo}
                max={toInput(new Date())}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-amber-400"
              />
            </div>
          ) : (
            <span className="text-xs text-gray-500">
              {dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}
            </span>
          )}

          {summary && (
            <div className="flex items-center gap-4 ml-2">
              <span className="text-xs text-gray-500">
                Omzet:{" "}
                <span className="font-medium text-gray-800">
                  {fmt(summary.totalRevenue)}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                Transaksi:{" "}
                <span className="font-medium text-gray-800">
                  {summary.totalTransactions}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                Rata-rata:{" "}
                <span className="font-medium text-gray-800">
                  {fmt(summary.avgTransaction)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* METRIC CARDS */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: "Total omzet",
                value: fmt(summary?.totalRevenue ?? 0),
                sub: "periode ini",
              },
              {
                label: "Total transaksi",
                value: summary?.totalTransactions ?? 0,
                sub: "transaksi",
              },
              {
                label: "Total item terjual",
                value: summary?.totalItems ?? 0,
                sub: "item",
              },
              {
                label: "Rata-rata transaksi",
                value: fmt(summary?.avgTransaction ?? 0),
                sub: "per transaksi",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-white rounded-xl p-4 border border-gray-100"
              >
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className="text-xl font-medium text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* CHARTS ROW */}
          <div className="grid grid-cols-3 gap-3">

            {/* Grafik harian */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-medium text-gray-400 tracking-wider">
                  PENJUALAN PER HARI
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

              {dailyChart.length === 0 ? (
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
                          id="omzetFillLaporan"
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
                        fontSize={10}
                        tick={{ fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
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
                        fill="url(#omzetFillLaporan)"
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

            {/* Top produk */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                TOP PRODUK
              </p>
              {topProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada data.</p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.slice(0, 5).map((p, i) => {
                    const maxQty = topProducts[0].qty;
                    const pct = Math.round((p.qty / maxQty) * 100);
                    return (
                      <div key={p.productId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-700 truncate max-w-[120px]">
                            <span className="text-gray-400 mr-1">{i + 1}.</span>
                            {p.name}
                          </span>
                          <span className="text-xs font-medium text-amber-700">
                            {p.qty} pcs
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* JAM RAMAI — Recharts BarChart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-gray-400 tracking-wider">
                  JAM RAMAI (PEAK HOUR)
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Distribusi transaksi per jam
                </p>
              </div>
              {peakHour && peakHour.count > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Jam puncak</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">
                    {peakHour.label} · {peakHour.count} trx
                  </span>
                </div>
              )}
            </div>

            {hourChart.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">
                Tidak ada data.
              </p>
            ) : (
              <>
                <div style={{ width: "100%", height: 160 }}>
                  <PeakHourChart data={hourChart} />
                </div>

                {/* Mini summary strip */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
                  {(() => {
                    const sorted = [...hourChart].sort(
                      (a, b) => b.count - a.count
                    );
                    const activeHours = hourChart.filter((h) => h.count > 0);
                    const total = hourChart.reduce(
                      (s, h) => s + h.count,
                      0
                    );
                    return [
                      {
                        label: "Jam tersibuk",
                        value: sorted[0]?.label ?? "-",
                        sub: `${sorted[0]?.count ?? 0} transaksi`,
                      },
                      {
                        label: "Jam tersunyi",
                        value: activeHours.at(-1)?.label ?? "-",
                        sub: `${activeHours.at(-1)?.count ?? 0} transaksi`,
                      },
                      {
                        label: "Total jam aktif",
                        value: `${activeHours.length} jam`,
                        sub: `dari ${total} transaksi`,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-gray-50 rounded-lg px-3 py-2.5"
                      >
                        <p className="text-[10px] text-gray-400 mb-0.5">
                          {s.label}
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {s.value}
                        </p>
                        <p className="text-[10px] text-gray-400">{s.sub}</p>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </div>

          {/* TABEL TRANSAKSI */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "NO",
                    "TGL",
                    "WAKTU",
                    "ID TRANSAKSI",
                    "NAMA PRODUK",
                    "QTY",
                    "HARGA",
                    "SUBTOTAL",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 text-sm text-gray-400"
                    >
                      Memuat laporan...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 text-sm text-gray-400"
                    >
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={`${r.idTrx}-${r.no}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {r.no}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.tanggal}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.waktu}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">
                        {r.idTrx}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.namaProduk}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.qty}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {fmtFull(r.harga)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-700">
                        {fmtFull(r.subtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && summary && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td
                      colSpan={7}
                      className="px-4 py-3 text-xs font-medium text-gray-500 text-right"
                    >
                      Total Omzet
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-amber-700">
                      {fmtFull(summary.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}