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
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────
interface TxnItem {
  productId: string;
  qty: number;
  price: number;
  note?: string | null;
  product?: { name: string };
}
interface Transaction {
  id: string;
  total: number;
  discountAmount?: number;
  paymentMethod?: string;
  status?: "COMPLETED" | "VOID" | "REFUNDED";
  voidReason?: string | null;
  refundReason?: string | null;
  voidedAt?: string | null;
  refundedAt?: string | null;
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
interface SlowProduct {
  productId: string;
  name: string;
  stock: number;
  lastSoldAt: string | null;
  daysSinceLastSold: number | null;
  totalSoldThisPeriod: number;
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
type ActiveTab =
  | "laporan"
  | "produkLaku"
  | "barangLambat"
  | "audit"
  | "pajak";

// ── Helpers ────────────────────────────────────────────────────
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

// ── Shared Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      backgroundColor: "#111827",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      fontSize: "12px",
      padding: "10px 14px",
    }}>
      <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>{label}</p>
      <p style={{ color: "#f59e0b", margin: 0, fontWeight: 600, fontSize: "14px" }}>
        {fmt(payload[0].value as number)}
      </p>
    </div>
  );
};

// ── Peak Hour Chart ────────────────────────────────────────────
function PeakHourChart({ data }: { data: HourChart[] }) {
  if (!data.length) return null;
  const peakIdx = data.reduce((best, h, i) => (h.count > data[best].count ? i : best), 0);
  const CustomBar = (props: any) => {
    const { x, y, width, height, index } = props;
    if (!width || !height) return null;
    const isPeak = index === peakIdx;
    const isEmpty = data[index].count === 0;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
          fill={isEmpty ? "transparent" : isPeak ? "#BA7517" : "#FAEEDA"} />
        {isPeak && !isEmpty && (
          <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="url(#peakGlow)" />
        )}
      </g>
    );
  };
  const PeakTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "12px", padding: "10px 14px" }}>
        <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>{label}</p>
        <p style={{ color: "#f59e0b", margin: 0, fontWeight: 600, fontSize: "14px" }}>{payload[0].value} transaksi</p>
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.map(h => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }))}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
        <defs>
          <linearGradient id="peakGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="label" fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={2} />
        <YAxis fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip content={<PeakTooltip />} cursor={{ fill: "rgba(186,117,23,0.06)" }} />
        <Bar dataKey="count" shape={<CustomBar />} maxBarSize={32} isAnimationActive animationDuration={700} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Tab Button ─────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
        active
          ? "bg-amber-600 text-white shadow-sm"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      }`}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

// ── FITUR 1: Dashboard Produk Laku & Tidak Laku ───────────────
function ProdukLakuTab({ topProducts, transactions, dateFrom, dateTo }: {
  topProducts: TopProduct[];
  transactions: Transaction[];
  dateFrom: string;
  dateTo: string;
}) {
  // Hitung semua produk dan qty terjual
  const productMap: Record<string, { name: string; qty: number; revenue: number; txCount: number }> = {};
  transactions.forEach(trx => {
    trx.items.forEach(item => {
      const name = item.product?.name ?? item.productId;
      if (!productMap[item.productId]) {
        productMap[item.productId] = { name, qty: 0, revenue: 0, txCount: 0 };
      }
      productMap[item.productId].qty += item.qty;
      productMap[item.productId].revenue += item.qty * item.price;
      productMap[item.productId].txCount += 1;
    });
  });
  const allProducts = Object.entries(productMap)
    .map(([id, v]) => ({ productId: id, ...v }))
    .sort((a, b) => b.qty - a.qty);

  const top5 = allProducts.slice(0, 5);
  const bottom5 = [...allProducts].sort((a, b) => a.qty - b.qty).slice(0, 5);

  // Pie data
  const totalQty = allProducts.reduce((s, p) => s + p.qty, 0);
  const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6"];
  const pieData = top5.map((p, i) => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
    value: p.qty,
    pct: totalQty > 0 ? Math.round((p.qty / totalQty) * 100) : 0,
    color: COLORS[i],
  }));

  // Revenue comparison bar
  const barData = allProducts.slice(0, 8).map(p => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name,
    omzet: p.revenue,
    qty: p.qty,
  }));

  const RevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "12px", padding: "10px 14px" }}>
        <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>{label}</p>
        <p style={{ color: "#f59e0b", margin: 0, fontWeight: 600 }}>{fmt(payload[0]?.value)}</p>
        <p style={{ color: "#9ca3af", margin: "2px 0 0 0", fontSize: "11px" }}>{payload[1]?.value} pcs terjual</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Dashboard Produk Laku</h2>
          <p className="text-xs text-gray-400 mt-0.5">Analisis performa produk lengkap periode {dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
          <span className="text-xs text-amber-700 font-medium">{allProducts.length} produk aktif</span>
        </div>
      </div>

      {allProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Tidak ada data produk pada periode ini.</p>
        </div>
      ) : (
        <>
          {/* Top 5 vs Bottom 5 */}
          <div className="grid grid-cols-2 gap-3">
            {/* Top 5 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🏆</span>
                <p className="text-xs font-semibold text-gray-700 tracking-wide">5 PRODUK TERLARIS</p>
              </div>
              <div className="space-y-3">
                {top5.map((p, i) => {
                  const maxQty = top5[0].qty;
                  const pct = Math.round((p.qty / maxQty) * 100);
                  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
                  return (
                    <div key={p.productId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 flex items-center gap-1.5">
                          <span className="text-sm">{medals[i]}</span>
                          <span className="truncate max-w-[130px]">{p.name}</span>
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-amber-700">{p.qty} pcs</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">{fmt(p.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-amber-50 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom 5 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📉</span>
                <p className="text-xs font-semibold text-gray-700 tracking-wide">5 PRODUK KURANG LAKU</p>
              </div>
              <div className="space-y-3">
                {bottom5.map((p, i) => {
                  const maxQty = bottom5[bottom5.length - 1].qty || 1;
                  const pct = Math.round((p.qty / maxQty) * 100);
                  return (
                    <div key={p.productId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                          <span className="truncate max-w-[130px]">{p.name}</span>
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-red-600">{p.qty} pcs</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">{fmt(p.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-red-50 rounded-full h-1.5">
                        <div className="bg-red-400 h-1.5 rounded-full transition-all" style={{ width: `${Math.max(pct, 8)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Pie chart kontribusi */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">KONTRIBUSI PENJUALAN</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} pcs`, "Qty"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {pieData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-[10px] text-gray-600 truncate max-w-[90px]">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-700">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue bar chart */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">OMZET PER PRODUK (TOP 8)</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                    <YAxis fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={60} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(186,117,23,0.06)" }} />
                    <Bar dataKey="omzet" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#f59e0b" : i < 3 ? "#fbbf24" : "#fed7aa"} />
                      ))}
                    </Bar>
                    <Bar dataKey="qty" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabel lengkap semua produk */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700">TABEL LENGKAP SEMUA PRODUK</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["RANK", "PRODUK", "QTY TERJUAL", "OMZET", "FREKUENSI TRX", "KONTRIBUSI"].map(h => (
                    <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allProducts.map((p, i) => {
                  const pct = totalQty > 0 ? ((p.qty / totalQty) * 100).toFixed(1) : "0.0";
                  const isTop = i < 3;
                  const isBottom = i >= allProducts.length - 3 && allProducts.length > 3;
                  return (
                    <tr key={p.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-semibold ${isTop ? "text-amber-600" : isBottom ? "text-red-500" : "text-gray-500"}`}>
                          #{i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{p.qty} pcs</td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-700">{fmtFull(p.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.txCount}×</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[60px]">
                            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── FITUR 2: Analisis Barang Lambat ───────────────────────────
function BarangLambatTab({ slowProducts, dateFrom, dateTo }: {
  slowProducts: SlowProduct[];
  dateFrom: string;
  dateTo: string;
}) {
  const [sortBy, setSortBy] = useState<"days" | "stock" | "sold">("days");

  const sorted = [...slowProducts].sort((a, b) => {
    if (sortBy === "days") return (b.daysSinceLastSold ?? 9999) - (a.daysSinceLastSold ?? 9999);
    if (sortBy === "stock") return b.stock - a.stock;
    return a.totalSoldThisPeriod - b.totalSoldThisPeriod;
  });

  const kritisCount = slowProducts.filter(p => (p.daysSinceLastSold ?? 0) > 30).length;
  const waspasCount = slowProducts.filter(p => {
    const d = p.daysSinceLastSold ?? 0;
    return d >= 14 && d <= 30;
  }).length;
  const totalStock = slowProducts.reduce((s, p) => s + p.stock, 0);

  function statusBadge(p: SlowProduct) {
    const d = p.daysSinceLastSold ?? 999;
    if (p.lastSoldAt === null) return { label: "Belum pernah terjual", color: "bg-gray-100 text-gray-600" };
    if (d > 30) return { label: "Kritis", color: "bg-red-100 text-red-700" };
    if (d >= 14) return { label: "Waspadai", color: "bg-amber-100 text-amber-700" };
    return { label: "Perlu perhatian", color: "bg-blue-100 text-blue-700" };
  }

  // Stock value estimate (jika ada harga — mock avg)
  const chartData = sorted.slice(0, 10).map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    hari: p.daysSinceLastSold ?? 999,
    stok: p.stock,
  }));

  const SlowTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "12px", padding: "10px 14px" }}>
        <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>{label}</p>
        <p style={{ color: "#ef4444", margin: 0, fontWeight: 600 }}>{payload[0]?.value} hari</p>
        <p style={{ color: "#9ca3af", margin: "2px 0 0 0", fontSize: "11px" }}>Stok: {payload[1]?.value} unit</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Analisis Barang Perputaran Lambat</h2>
          <p className="text-xs text-gray-400 mt-0.5">Produk yang jarang atau belum terjual dalam periode ini</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total produk lambat", value: slowProducts.length, sub: "produk", color: "text-gray-800" },
          { label: "Status kritis (>30 hari)", value: kritisCount, sub: "tidak terjual", color: "text-red-600" },
          { label: "Perlu diwaspadai", value: waspasCount, sub: "14–30 hari", color: "text-amber-600" },
          { label: "Total stok tertahan", value: totalStock.toLocaleString("id-ID"), sub: "unit", color: "text-blue-600" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-xl font-semibold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {slowProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-gray-600 text-sm font-medium">Semua produk berputar dengan baik!</p>
          <p className="text-gray-400 text-xs mt-1">Tidak ada produk dengan perputaran lambat pada periode ini.</p>
        </div>
      ) : (
        <>
          {/* Bar chart top 10 produk paling lama tidak terjual */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">10 PRODUK PALING LAMA TIDAK TERJUAL (HARI)</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 28 }} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                  <XAxis type="number" fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: "#6b7280" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<SlowTooltip />} cursor={{ fill: "rgba(239,68,68,0.05)" }} />
                  <Bar dataKey="hari" maxBarSize={18} radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.hari > 30 ? "#ef4444" : d.hari >= 14 ? "#f59e0b" : "#60a5fa"} />
                    ))}
                  </Bar>
                  <Bar dataKey="stok" hide />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
              {[
                { color: "#ef4444", label: "Kritis (>30 hari)" },
                { color: "#f59e0b", label: "Waspadai (14–30 hari)" },
                { color: "#60a5fa", label: "Perhatian (<14 hari)" },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">DAFTAR PRODUK LAMBAT</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">Urutkan:</span>
                {[
                  { key: "days" as const, label: "Hari" },
                  { key: "stock" as const, label: "Stok" },
                  { key: "sold" as const, label: "Terjual" },
                ].map(s => (
                  <button key={s.key} onClick={() => setSortBy(s.key)}
                    className={`px-2 py-1 text-[10px] rounded-md transition-colors ${sortBy === s.key ? "bg-amber-100 text-amber-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["PRODUK", "STOK TERSISA", "TERAKHIR TERJUAL", "TIDAK TERJUAL", "TERJUAL PERIODE INI", "STATUS"].map(h => (
                    <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(p => {
                  const badge = statusBadge(p);
                  return (
                    <tr key={p.productId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.stock.toLocaleString("id-ID")} unit</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {p.lastSoldAt
                          ? new Date(p.lastSoldAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                          : <span className="text-gray-400 italic">Belum pernah</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {p.daysSinceLastSold !== null
                          ? <span className={p.daysSinceLastSold > 30 ? "font-semibold text-red-600" : "text-gray-700"}>{p.daysSinceLastSold} hari</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.totalSoldThisPeriod} pcs</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rekomendasi */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">💡</span>
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-1">Rekomendasi Tindakan</p>
                <ul className="text-xs text-amber-700 space-y-1 list-none">
                  <li>• <strong>Status Kritis:</strong> Pertimbangkan diskon, bundling, atau retur ke supplier untuk produk yang tidak terjual 30 hari.</li>
                  <li>• <strong>Waspadai:</strong> Kurangi pembelian stok baru, evaluasi penempatan di display toko.</li>
                  <li>• <strong>Stok Tinggi:</strong> Produk dengan stok besar yang lambat terjual perlu strategi promosi khusus.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── FITUR 3: Laporan Audit Profesional ────────────────────────
function AuditTab({ transactions, summary, topProducts, dateFrom, dateTo }: {
  transactions: Transaction[];
  summary: Summary | null;
  topProducts: TopProduct[];
  dateFrom: string;
  dateTo: string;
}) {
  const periode = dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;

  // Hitung metrics audit
  const itemsPerTrx = summary && summary.totalTransactions > 0
    ? (summary.totalItems / summary.totalTransactions).toFixed(1) : "0";

  // Distribusi transaksi per nilai
  const brackets = [
    { label: "< Rp 50rb", min: 0, max: 50000 },
    { label: "Rp 50–100rb", min: 50000, max: 100000 },
    { label: "Rp 100–200rb", min: 100000, max: 200000 },
    { label: "Rp 200–500rb", min: 200000, max: 500000 },
    { label: "> Rp 500rb", min: 500000, max: Infinity },
  ];
  const distribution = brackets.map(b => ({
    label: b.label,
    count: transactions.filter(t => t.total >= b.min && t.total < b.max).length,
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  // Transaksi terbesar
  const topTrx = [...transactions].sort((a, b) => b.total - a.total).slice(0, 5);

  // Cari anomali (transaksi dengan total 0 atau sangat besar)
  const avgTrx = summary?.avgTransaction ?? 0;
  const anomalies = transactions.filter(t => t.total === 0 || t.total > avgTrx * 5);

  function exportAuditPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("LAPORAN AUDIT PENJUALAN", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${periode}`, 14, 26);
    doc.text(`Diterbitkan: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 14, 32);
    doc.text(`Total Transaksi Diaudit: ${summary?.totalTransactions ?? 0}`, 14, 38);

    if (summary) {
      autoTable(doc, {
        head: [["RINGKASAN FINANSIAL", "NILAI"]],
        body: [
          ["Total Omzet Kotor", fmtFull(summary.totalRevenue)],
          ["Jumlah Transaksi", String(summary.totalTransactions)],
          ["Total Item Terjual", String(summary.totalItems)],
          ["Rata-rata Transaksi", fmtFull(summary.avgTransaction)],
          ["Item per Transaksi", itemsPerTrx],
          ["Potensi Anomali", String(anomalies.length)],
        ],
        startY: 45,
        theme: "grid",
        headStyles: { fillColor: [31, 41, 55] },
        styles: { fontSize: 9 },
        tableWidth: 90,
      });
    }

    autoTable(doc, {
      head: [["PRODUK", "QTY", "OMZET", "% KONTRIBUSI"]],
      body: topProducts.map(p => [
        p.name,
        String(p.qty),
        fmtFull(p.revenue),
        summary ? `${((p.revenue / summary.totalRevenue) * 100).toFixed(1)}%` : "-",
      ]),
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "grid",
      headStyles: { fillColor: [31, 41, 55] },
      styles: { fontSize: 9 },
    });

    if (anomalies.length > 0) {
      autoTable(doc, {
        head: [["ID TRANSAKSI", "WAKTU", "TOTAL", "KETERANGAN"]],
        body: anomalies.map(t => [
          t.id.slice(0, 12) + "...",
          new Date(t.createdAt).toLocaleString("id-ID"),
          fmtFull(t.total),
          t.total === 0 ? "Transaksi nol" : "Nilai tidak wajar",
        ]),
        startY: (doc as any).lastAutoTable.finalY + 8,
        theme: "grid",
        headStyles: { fillColor: [153, 27, 27] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(`Audit_${dateFrom}_${dateTo}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Laporan Audit Profesional</h2>
          <p className="text-xs text-gray-400 mt-0.5">Periode: {periode} · Diterbitkan {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={exportAuditPDF}
          className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
          Export Audit PDF
        </button>
      </div>

      {/* Audit summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-4 bg-gray-800 rounded-full"></span>
            <p className="text-xs font-semibold text-gray-700 tracking-wide">RINGKASAN AUDIT FINANSIAL</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Omzet Kotor", value: fmtFull(summary?.totalRevenue ?? 0), accent: true },
              { label: "Total Transaksi", value: String(summary?.totalTransactions ?? 0) },
              { label: "Item per Transaksi", value: itemsPerTrx + " item/trx" },
              { label: "Total Item Terjual", value: String(summary?.totalItems ?? 0) },
              { label: "Rata-rata Transaksi", value: fmt(summary?.avgTransaction ?? 0) },
              { label: "Potensi Anomali", value: anomalies.length > 0 ? `${anomalies.length} transaksi` : "Tidak ada", alert: anomalies.length > 0 },
            ].map(m => (
              <div key={m.label} className={`p-3 rounded-lg ${m.accent ? "bg-gray-800 text-white" : m.alert ? "bg-red-50" : "bg-gray-50"}`}>
                <p className={`text-[10px] mb-1 ${m.accent ? "text-gray-300" : m.alert ? "text-red-400" : "text-gray-400"}`}>{m.label}</p>
                <p className={`text-sm font-semibold ${m.accent ? "text-white" : m.alert ? "text-red-700" : "text-gray-800"}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Anomali */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
            <p className="text-xs font-semibold text-gray-700 tracking-wide">DETEKSI ANOMALI</p>
          </div>
          {anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <span className="text-2xl mb-1">✅</span>
              <p className="text-xs text-gray-500">Tidak ada anomali terdeteksi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.slice(0, 4).map(t => (
                <div key={t.id} className="flex items-start justify-between p-2.5 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-[10px] font-mono text-red-800">{t.id.slice(0, 10)}...</p>
                    <p className="text-[10px] text-red-500">{t.total === 0 ? "Nilai nol" : "Nilai tidak wajar"}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-700">{fmt(t.total)}</span>
                </div>
              ))}
              {anomalies.length > 4 && (
                <p className="text-[10px] text-gray-400 text-center">+{anomalies.length - 4} anomali lainnya</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Distribusi nilai transaksi */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">DISTRIBUSI NILAI TRANSAKSI</p>
        <div className="space-y-3">
          {distribution.map(d => {
            const pct = Math.round((d.count / maxCount) * 100);
            const totalPct = summary && summary.totalTransactions > 0
              ? ((d.count / summary.totalTransactions) * 100).toFixed(1) : "0";
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-32 flex-shrink-0">{d.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-gray-700 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-20 text-right">{d.count} trx ({totalPct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top transaksi terbesar */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">5 TRANSAKSI TERBESAR (UNTUK VERIFIKASI)</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["ID TRANSAKSI", "WAKTU", "PRODUK", "TOTAL", "KETERANGAN"].map(h => (
                <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {topTrx.map((t, i) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{t.id.slice(0, 12)}...</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(t.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{t.items.map(it => it.product?.name ?? "-").join(", ")}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmtFull(t.total)}</td>
                <td className="px-4 py-3">
                  {i === 0
                    ? <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">Tertinggi</span>
                    : t.total > (summary?.avgTransaction ?? 0) * 3
                      ? <span className="px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded-full">Di atas rata-rata</span>
                      : <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">Normal</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pernyataan audit */}
      <div className="bg-gray-800 rounded-xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">📋</div>
          <div>
            <p className="text-sm font-semibold mb-1">Pernyataan Laporan Audit</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Laporan ini dibuat secara otomatis berdasarkan data transaksi sistem POS untuk periode {periode}.
              Data mencakup {summary?.totalTransactions ?? 0} transaksi dengan total omzet {fmtFull(summary?.totalRevenue ?? 0)}.
              Laporan ini bersifat internal dan tidak menggantikan audit akuntan publik bersertifikat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FITUR 4: Laporan Pajak / Keuangan Resmi ───────────────────
function PajakTab({ summary, topProducts, transactions, dateFrom, dateTo }: {
  summary: Summary | null;
  topProducts: TopProduct[];
  transactions: Transaction[];
  dateFrom: string;
  dateTo: string;
}) {
  const [taxRate, setTaxRate] = useState(11); // PPN 11%
  const periode = dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;

  const omzetKotor = summary?.totalRevenue ?? 0;
  const ppn = Math.round(omzetKotor * (taxRate / 100));
  const omzetNeto = omzetKotor - ppn;
  const hpp = Math.round(omzetNeto * 0.6); // estimasi HPP 60%
  const labaKotor = omzetNeto - hpp;
  const biayaOperasional = Math.round(omzetNeto * 0.1);
  const labaBersih = labaKotor - biayaOperasional;
  const pph = Math.round(labaBersih * 0.005); // PPh Final UMKM 0.5%

  // Monthly breakdown untuk chart
  const monthlyData: Record<string, number> = {};
  transactions.forEach(t => {
    const key = new Date(t.createdAt).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    monthlyData[key] = (monthlyData[key] ?? 0) + t.total;
  });
  const monthlyChart = Object.entries(monthlyData).map(([name, omzet]) => ({ name, omzet }));

  function exportPajakExcel() {
    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet([
      { Uraian: "LAPORAN KEUANGAN & PAJAK", Nilai: "" },
      { Uraian: `Periode: ${periode}`, Nilai: "" },
      { Uraian: "", Nilai: "" },
      { Uraian: "A. PENDAPATAN", Nilai: "" },
      { Uraian: "Omzet Kotor", Nilai: omzetKotor },
      { Uraian: `PPN (${taxRate}%)`, Nilai: ppn },
      { Uraian: "Omzet Neto (DPP)", Nilai: omzetNeto },
      { Uraian: "", Nilai: "" },
      { Uraian: "B. HARGA POKOK PENJUALAN (estimasi)", Nilai: "" },
      { Uraian: "HPP (estimasi 60% dari Omzet Neto)", Nilai: hpp },
      { Uraian: "Laba Kotor", Nilai: labaKotor },
      { Uraian: "", Nilai: "" },
      { Uraian: "C. BIAYA OPERASIONAL (estimasi)", Nilai: "" },
      { Uraian: "Biaya Operasional (estimasi 10%)", Nilai: biayaOperasional },
      { Uraian: "Laba Bersih Sebelum Pajak", Nilai: labaBersih },
      { Uraian: "", Nilai: "" },
      { Uraian: "D. KEWAJIBAN PAJAK", Nilai: "" },
      { Uraian: `PPN Keluaran (${taxRate}%)`, Nilai: ppn },
      { Uraian: "PPh Final UMKM (0.5% dari omzet)", Nilai: pph },
      { Uraian: "Total Kewajiban Pajak", Nilai: ppn + pph },
    ]);
    utils.book_append_sheet(wb, ws1, "Lap. Keuangan & Pajak");

    const ws2 = utils.json_to_sheet(
      topProducts.map((p, i) => ({
        No: i + 1,
        Produk: p.name,
        "Qty Terjual": p.qty,
        "Omzet Produk": p.revenue,
        "PPN Produk": Math.round(p.revenue * (taxRate / 100)),
        "DPP Produk": Math.round(p.revenue * (1 - taxRate / 100)),
      }))
    );
    utils.book_append_sheet(wb, ws2, "Rincian Produk");

    writeFile(wb, `Laporan_Pajak_${dateFrom}_${dateTo}.xlsx`);
  }

  function exportPajakPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("LAPORAN KEUANGAN & PERPAJAKAN", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${periode}`, 14, 26);
    doc.text(`Tanggal cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 14, 32);

    autoTable(doc, {
      head: [["URAIAN", "JUMLAH"]],
      body: [
        ["A. PENDAPATAN", ""],
        ["Omzet Kotor", fmtFull(omzetKotor)],
        [`PPN (${taxRate}%)`, `(${fmtFull(ppn)})`],
        ["Dasar Pengenaan Pajak (DPP)", fmtFull(omzetNeto)],
        ["", ""],
        ["B. HARGA POKOK PENJUALAN", ""],
        ["HPP (estimasi 60%)", `(${fmtFull(hpp)})`],
        ["Laba Kotor", fmtFull(labaKotor)],
        ["", ""],
        ["C. BIAYA OPERASIONAL", ""],
        ["Biaya Operasional (est. 10%)", `(${fmtFull(biayaOperasional)})`],
        ["Laba Bersih Sebelum Pajak", fmtFull(labaBersih)],
        ["", ""],
        ["D. KEWAJIBAN PAJAK", ""],
        [`PPN Keluaran (${taxRate}%)`, fmtFull(ppn)],
        ["PPh Final UMKM (0.5%)", fmtFull(pph)],
        ["TOTAL KEWAJIBAN PAJAK", fmtFull(ppn + pph)],
      ],
      startY: 38,
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" } },
    });
    doc.save(`Laporan_Pajak_${dateFrom}_${dateTo}.pdf`);
  }

  const FinRow = ({ label, value, bold, indent, highlight, note }: {
    label: string; value: string; bold?: boolean; indent?: boolean; highlight?: "green" | "red" | "blue"; note?: string;
  }) => (
    <tr className={`border-b border-gray-50 ${highlight === "green" ? "bg-green-50" : highlight === "red" ? "bg-red-50" : highlight === "blue" ? "bg-blue-50" : ""}`}>
      <td className={`py-2.5 px-4 text-xs ${indent ? "pl-8 text-gray-500" : bold ? "font-semibold text-gray-800" : "text-gray-600"}`}>
        {label}
        {note && <span className="ml-2 text-[10px] text-gray-400">({note})</span>}
      </td>
      <td className={`py-2.5 px-4 text-xs text-right font-mono ${bold ? "font-semibold text-gray-900" : "text-gray-700"} ${highlight === "green" ? "text-green-700" : highlight === "red" ? "text-red-600" : ""}`}>
        {value}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Laporan Keuangan & Perpajakan</h2>
          <p className="text-xs text-gray-400 mt-0.5">Format resmi untuk keperluan pelaporan pajak UMKM</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-gray-500">Tarif PPN:</span>
            <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))}
              className="text-xs font-medium text-gray-800 border-none outline-none bg-transparent cursor-pointer">
              <option value={11}>11%</option>
              <option value={10}>10%</option>
              <option value={12}>12%</option>
            </select>
          </div>
          <button onClick={exportPajakExcel}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            Export Excel
          </button>
          <button onClick={exportPajakPDF}
            className="px-3 py-1.5 text-xs font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors">
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Laporan L/R */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-green-700 text-white">
            <p className="text-xs font-semibold tracking-wide">LAPORAN LABA RUGI & PERPAJAKAN</p>
            <p className="text-[10px] text-green-200 mt-0.5">Periode: {periode}</p>
          </div>
          <table className="w-full">
            <tbody>
              <tr className="bg-gray-50">
                <td colSpan={2} className="py-2 px-4 text-[10px] font-bold text-gray-500 tracking-widest">A. PENDAPATAN</td>
              </tr>
              <FinRow label="Omzet Kotor" value={fmtFull(omzetKotor)} />
              <FinRow label={`PPN Keluaran (${taxRate}%)`} value={`(${fmtFull(ppn)})`} indent note="dipungut dari pembeli" />
              <FinRow label="Dasar Pengenaan Pajak (DPP)" value={fmtFull(omzetNeto)} bold highlight="blue" />
              <tr className="bg-gray-50">
                <td colSpan={2} className="py-2 px-4 text-[10px] font-bold text-gray-500 tracking-widest">B. HARGA POKOK PENJUALAN</td>
              </tr>
              <FinRow label="HPP (estimasi 60% dari DPP)" value={`(${fmtFull(hpp)})`} indent note="estimasi" />
              <FinRow label="Laba Kotor" value={fmtFull(labaKotor)} bold />
              <tr className="bg-gray-50">
                <td colSpan={2} className="py-2 px-4 text-[10px] font-bold text-gray-500 tracking-widest">C. BIAYA OPERASIONAL</td>
              </tr>
              <FinRow label="Biaya Operasional (est. 10%)" value={`(${fmtFull(biayaOperasional)})`} indent note="estimasi" />
              <FinRow label="Laba Bersih Sebelum Pajak" value={fmtFull(labaBersih)} bold highlight={labaBersih >= 0 ? "green" : "red"} />
              <tr className="bg-gray-50">
                <td colSpan={2} className="py-2 px-4 text-[10px] font-bold text-gray-500 tracking-widest">D. KEWAJIBAN PAJAK</td>
              </tr>
              <FinRow label={`PPN Keluaran (${taxRate}% × Omzet Kotor)`} value={fmtFull(ppn)} indent />
              <FinRow label="PPh Final UMKM (0.5% × Omzet Kotor)" value={fmtFull(pph)} indent note="PP 55/2022" />
              <FinRow label="Total Kewajiban Pajak" value={fmtFull(ppn + pph)} bold highlight="red" />
            </tbody>
          </table>
        </div>

        {/* Info box */}
        <div className="space-y-3">
          {/* KPI */}
          {[
            { label: "Omzet Kotor", value: fmtFull(omzetKotor), color: "text-gray-900", bg: "bg-white" },
            { label: "DPP (Neto)", value: fmtFull(omzetNeto), color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Laba Bersih Est.", value: fmtFull(labaBersih), color: labaBersih >= 0 ? "text-green-700" : "text-red-600", bg: labaBersih >= 0 ? "bg-green-50" : "bg-red-50" },
            { label: "Total Pajak", value: fmtFull(ppn + pph), color: "text-red-700", bg: "bg-red-50" },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl border border-gray-100 p-4`}>
              <p className="text-[10px] text-gray-400 mb-0.5">{k.label}</p>
              <p className={`text-base font-semibold ${k.color}`}>{k.value}</p>
            </div>
          ))}

          {/* Catatan */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <p className="text-[10px] font-semibold text-amber-700 mb-1.5">⚠️ Catatan Penting</p>
            <ul className="text-[10px] text-amber-700 space-y-1">
              <li>• HPP & biaya operasional adalah estimasi</li>
              <li>• Konsultasikan dengan akuntan untuk kepatuhan pajak resmi</li>
              <li>• PPh 0.5% berlaku untuk UMKM omzet &lt; Rp4,8M/tahun</li>
              <li>• PPN wajib jika PKP (&gt;Rp4,8M omzet/tahun)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Chart omzet per bulan jika ada data */}
      {monthlyChart.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">OMZET PER BULAN (PERIODE INI)</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={64} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(21,128,61,0.06)" }} />
                <Bar dataKey="omzet" fill="#15803d" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rincian produk untuk pajak */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">RINCIAN PER PRODUK (UNTUK FAKTUR PAJAK)</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["NO", "PRODUK", "QTY", "OMZET KOTOR", `PPN (${taxRate}%)`, "DPP"].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topProducts.map((p, i) => {
                const ppnProduk = Math.round(p.revenue * (taxRate / 100));
                const dppProduk = p.revenue - ppnProduk;
                return (
                  <tr key={p.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.qty}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{fmtFull(p.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{fmtFull(ppnProduk)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-700">{fmtFull(dppProduk)}</td>
                  </tr>
                );
              })}
              <tr className="bg-green-50 border-t-2 border-green-200">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">TOTAL</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtFull(omzetKotor)}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-700">{fmtFull(ppn)}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">{fmtFull(omzetNeto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function LaporanPage() {
  const { data: session, status } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();
  const storeId = isDemoMode
    ? demoStoreId
    : (session?.user as any)?.storeId ?? "";

  const [activeTab, setActiveTab] = useState<ActiveTab>("laporan");
  const [mode, setMode] = useState<Mode>("harian");
  const [dateFrom, setDateFrom] = useState(toInput(new Date()));
  const [dateTo, setDateTo] = useState(toInput(new Date()));

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [slowProducts, setSlowProducts] = useState<SlowProduct[]>([]);
  const [dailyChart, setDailyChart] = useState<DailyChart[]>([]);
  const [hourChart, setHourChart] = useState<HourChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storeName, setStoreName] = useState("TokoKu");

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

  useEffect(() => {
    if (status === "loading" || !storeId) return;

    fetch("/api/stores")
      .then((res) => res.json())
      .then((stores) => {
        if (!Array.isArray(stores)) return;
        const activeStore = stores.find((store) => store.id === storeId);
        if (activeStore?.name) setStoreName(activeStore.name);
      })
      .catch(() => {});
  }, [storeId, status]);

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
      setSlowProducts(data.slowProducts ?? []);
      setDailyChart(data.dailyChart ?? []);
      setHourChart(data.hourChart ?? []);
    } catch {
      setError("Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransactionAction(
    trx: Transaction,
    action: "VOID" | "REFUND"
  ) {
    if ((trx.status ?? "COMPLETED") !== "COMPLETED") return;

    const reason = window.prompt(
      action === "VOID"
        ? "Masukkan alasan void transaksi:"
        : "Masukkan alasan refund transaksi:"
    )?.trim();

    if (!reason) return;

    const confirmed = window.confirm(
      action === "VOID"
        ? "Transaksi akan dibatalkan dan stok dikembalikan. Lanjutkan?"
        : "Transaksi akan di-refund penuh dan stok dikembalikan. Lanjutkan?"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/transactions/${trx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memperbarui transaksi");

      await fetchLaporan();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui transaksi";
      window.alert(message);
    }
  }

  function buildRows() {
    let no = 1;
    return transactions.flatMap((trx) =>
      trx.items.map((item) => ({
        no: no++,
        waktu: new Date(trx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        tanggal: new Date(trx.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        idTrx: trx.id.slice(0, 8),
        namaProduk: item.product?.name ?? "-",
        qty: item.qty,
        harga: item.price,
        subtotal: item.qty * item.price,
      }))
    );
  }

  function printTransaction(trx: Transaction) {
    const subtotal = trx.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const discount = trx.discountAmount ?? Math.max(0, subtotal - trx.total);
    const paymentMethod = trx.paymentMethod === "qris" ? "QRIS" : "TUNAI";
    const transactionStatus = trx.status ?? "COMPLETED";
    const statusLabel =
      transactionStatus === "VOID"
        ? "VOID"
        : transactionStatus === "REFUNDED"
          ? "REFUND"
          : "SELESAI";
    const printedAt = new Date(trx.createdAt).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const itemRows = trx.items
      .map(
        (item) => `
      <tr>
        <td style="padding:1px 0">${item.product?.name ?? item.productId}</td>
        <td style="text-align:right;white-space:nowrap">${item.qty} x ${fmtFull(item.price)}</td>
      </tr>
      ${item.note?.trim()
            ? `<tr><td colspan="2" style="padding:0 0 3px 0;color:#666;font-size:11px">Catatan: ${item.note}</td></tr>`
            : ""}
      <tr>
        <td colspan="2" style="text-align:right;padding-bottom:3px">${fmtFull(item.qty * item.price)}</td>
      </tr>`
      )
      .join("");

    const discountRow =
      discount > 0
        ? `<tr><td>Diskon</td><td style="text-align:right">-${fmtFull(discount)}</td></tr>`
        : "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reprint Struk</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 8px; color: #000; }
  .center { text-align: center; }
  .store-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
  .divider-solid { border-top: 1px solid #000; margin: 6px 0; }
  .divider-dash { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; font-size: 12px; }
  .total-row td { font-size: 13px; font-weight: bold; padding-top: 3px; }
  .footer { text-align: center; margin-top: 8px; font-size: 11px; }
  @media print {
    body { width: 100%; }
    @page { margin: 4mm; size: 80mm auto; }
  }
</style>
</head><body>
  <div class="center">
    <div class="store-name">${storeName.toUpperCase()}</div>
    <div>Reprint Struk</div>
  </div>
  <div class="divider-solid"></div>
  <table>
    <tr><td>No. Transaksi</td><td style="text-align:right">#${trx.id.slice(0, 8).toUpperCase()}</td></tr>
    <tr><td>Tanggal</td><td style="text-align:right">${printedAt}</td></tr>
    <tr><td>Status</td><td style="text-align:right">${statusLabel}</td></tr>
  </table>
  <div class="divider-dash"></div>
  <table>${itemRows}</table>
  <div class="divider-dash"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${fmtFull(subtotal)}</td></tr>
    ${discountRow}
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${fmtFull(trx.total)}</td></tr>
  </table>
  <div class="divider-dash"></div>
  <table>
    <tr><td>Metode Bayar</td><td style="text-align:right">${paymentMethod}</td></tr>
  </table>
  <div class="divider-solid"></div>
  <div class="footer">
    <div>*** CETAK ULANG ***</div>
    <div style="margin-top:4px;font-size:10px">Powered by KasirKu</div>
  </div>
</body></html>`;

    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  }

  function exportExcel() {
    const rows = buildRows();
    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(rows.map(r => ({
      No: r.no, Tanggal: r.tanggal, Waktu: r.waktu,
      "ID Transaksi": r.idTrx, "Nama Produk": r.namaProduk,
      Qty: r.qty, "Harga Satuan": r.harga, Subtotal: r.subtotal,
    })));
    utils.book_append_sheet(wb, ws1, "Transaksi");
    const ws2 = utils.json_to_sheet([
      { Metrik: "Total Omzet", Nilai: summary?.totalRevenue ?? 0 },
      { Metrik: "Total Transaksi", Nilai: summary?.totalTransactions ?? 0 },
      { Metrik: "Total Item Terjual", Nilai: summary?.totalItems ?? 0 },
      { Metrik: "Rata-rata Transaksi", Nilai: summary?.avgTransaction ?? 0 },
    ]);
    utils.book_append_sheet(wb, ws2, "Summary");
    const ws3 = utils.json_to_sheet(topProducts.map((p, i) => ({
      Rank: i + 1, Produk: p.name, "Qty Terjual": p.qty, Omzet: p.revenue,
    })));
    utils.book_append_sheet(wb, ws3, "Top Produk");
    writeFile(wb, `Laporan_${dateFrom}_${dateTo}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    const periode = dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;
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
        startY: 27, theme: "grid",
        headStyles: { fillColor: [146, 64, 14] },
        styles: { fontSize: 9 }, tableWidth: 90,
      });
    }
    if (topProducts.length > 0) {
      autoTable(doc, {
        head: [["Rank", "Produk", "Qty", "Omzet"]],
        body: topProducts.map((p, i) => [i + 1, p.name, p.qty, fmtFull(p.revenue)]),
        startY: (doc as any).lastAutoTable.finalY + 8, theme: "grid",
        headStyles: { fillColor: [146, 64, 14] },
        styles: { fontSize: 9 }, tableWidth: 90,
      });
    }
    autoTable(doc, {
      head: [["No", "Tgl", "Waktu", "ID Trx", "Produk", "Qty", "Harga", "Subtotal"]],
      body: buildRows().map(r => [r.no, r.tanggal, r.waktu, r.idTrx + "...", r.namaProduk, r.qty, fmtFull(r.harga), fmtFull(r.subtotal)]),
      startY: (doc as any).lastAutoTable.finalY + 8, theme: "grid",
      headStyles: { fillColor: [146, 64, 14] },
      styles: { fontSize: 8 },
    });
    doc.save(`Laporan_${dateFrom}_${dateTo}.pdf`);
  }

  const rows = buildRows();
  const chartData = dailyChart.map(d => ({
    name: new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    omzet: d.revenue,
  }));

  const CustomDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    if (index === 0 || !chartData[index] || !chartData[index - 1]) return <circle cx={cx} cy={cy} r={5} fill="#BA7517" stroke="#fff" strokeWidth={2.5} />;
    const isUp = chartData[index].omzet >= chartData[index - 1].omzet;
    return <circle cx={cx} cy={cy} r={5} fill={isUp ? "#16a34a" : "#dc2626"} stroke="#fff" strokeWidth={2.5} />;
  };

  const peakHour = hourChart.length > 0
    ? hourChart.reduce((best, h) => (h.count > best.count ? h : best))
    : null;

  const MODES: { key: Mode; label: string }[] = [
    { key: "harian", label: "Harian" },
    { key: "mingguan", label: "Mingguan" },
    { key: "bulanan", label: "Bulanan" },
    { key: "custom", label: "Custom" },
  ];

  const TABS: { key: ActiveTab; icon: string; label: string }[] = [
    { key: "laporan", icon: "", label: "Laporan Utama" },
    { key: "produkLaku", icon: "", label: "Produk Laku" },
    { key: "barangLambat", icon: "", label: "Barang Lambat" },
    { key: "audit", icon: "", label: "Audit" },
    { key: "pajak", icon: "", label: "Pajak & Keuangan" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Laporan Penjualan</span>
          <div className="flex items-center gap-2">
            {activeTab === "laporan" && (
              <>
                <button onClick={exportExcel} disabled={rows.length === 0}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Export Excel
                </button>
                <button onClick={exportPDF} disabled={rows.length === 0}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Export PDF
                </button>
              </>
            )}
          </div>
        </header>

        {/* FILTER BAR */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Period mode */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === m.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {mode === "custom" ? (
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-amber-400" />
              <span className="text-xs text-gray-400">—</span>
              <input type="date" value={dateTo} max={toInput(new Date())}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-amber-400" />
            </div>
          ) : (
            <span className="text-xs text-gray-500">{dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}</span>
          )}
          {summary && (
            <div className="flex items-center gap-4 ml-2">
              <span className="text-xs text-gray-500">Omzet: <span className="font-medium text-gray-800">{fmt(summary.totalRevenue)}</span></span>
              <span className="text-xs text-gray-500">Transaksi: <span className="font-medium text-gray-800">{summary.totalTransactions}</span></span>
              <span className="text-xs text-gray-500">Rata-rata: <span className="font-medium text-gray-800">{fmt(summary.avgTransaction)}</span></span>
            </div>
          )}
        </div>

        {/* TAB NAV */}
        <div className="bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-1 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} />
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="px-4 py-3 mb-4 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>
          )}

          {/* TAB: LAPORAN UTAMA */}
          {activeTab === "laporan" && (
            <div className="space-y-4">
              {/* Metric Cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total omzet", value: fmt(summary?.totalRevenue ?? 0), sub: "periode ini" },
                  { label: "Total transaksi", value: summary?.totalTransactions ?? 0, sub: "transaksi" },
                  { label: "Total item terjual", value: summary?.totalItems ?? 0, sub: "item" },
                  { label: "Rata-rata transaksi", value: fmt(summary?.avgTransaction ?? 0), sub: "per transaksi" },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                    <p className="text-xl font-medium text-gray-900">{c.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-medium text-gray-400 tracking-wider">PENJUALAN PER HARI</p>
                    <div className="flex items-center gap-3">
                      {[{ color: "bg-green-600", label: "Naik" }, { color: "bg-red-600", label: "Turun" }, { color: "bg-amber-700", label: "Awal" }].map(l => (
                        <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                          <span className={`w-2 h-2 rounded-full ${l.color} inline-block`} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {dailyChart.length === 0 ? (
                    <p className="text-xs text-gray-400 py-8 text-center">Tidak ada data.</p>
                  ) : (
                    <div className="w-full h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="omzetFillLaporan" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                              <stop offset="60%" stopColor="#BA7517" stopOpacity={0.15} />
                              <stop offset="100%" stopColor="#BA7517" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
                          <XAxis dataKey="name" fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={64} />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(186,117,23,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                          <Area type="monotone" dataKey="omzet" stroke="#BA7517" strokeWidth={2.5} fill="url(#omzetFillLaporan)"
                            dot={<CustomDot />} activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2.5 }}
                            isAnimationActive animationDuration={900} animationEasing="ease-out" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">TOP PRODUK</p>
                  {topProducts.length === 0 ? (
                    <p className="text-xs text-gray-400">Belum ada data.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {topProducts.slice(0, 5).map((p, i) => {
                        const pct = Math.round((p.qty / topProducts[0].qty) * 100);
                        return (
                          <div key={p.productId}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-700 truncate max-w-[120px]">
                                <span className="text-gray-400 mr-1">{i + 1}.</span>{p.name}
                              </span>
                              <span className="text-xs font-medium text-amber-700">{p.qty} pcs</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Peak Hour */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-medium text-gray-400 tracking-wider">JAM RAMAI (PEAK HOUR)</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Distribusi transaksi per jam</p>
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
                  <p className="text-xs text-gray-400 py-8 text-center">Tidak ada data.</p>
                ) : (
                  <>
                    <div style={{ width: "100%", height: 160 }}>
                      <PeakHourChart data={hourChart} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
                      {(() => {
                        const sorted = [...hourChart].sort((a, b) => b.count - a.count);
                        const activeHours = hourChart.filter(h => h.count > 0);
                        const total = hourChart.reduce((s, h) => s + h.count, 0);
                        return [
                          { label: "Jam tersibuk", value: sorted[0]?.label ?? "-", sub: `${sorted[0]?.count ?? 0} transaksi` },
                          { label: "Jam tersunyi", value: activeHours.at(-1)?.label ?? "-", sub: `${activeHours.at(-1)?.count ?? 0} transaksi` },
                          { label: "Total jam aktif", value: `${activeHours.length} jam`, sub: `dari ${total} transaksi` },
                        ].map(s => (
                          <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                            <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                            <p className="text-sm font-medium text-gray-800">{s.value}</p>
                            <p className="text-[10px] text-gray-400">{s.sub}</p>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Tabel Transaksi */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["NO", "TGL", "WAKTU", "ID TRANSAKSI", "NAMA PRODUK", "QTY", "HARGA", "SUBTOTAL", "AKSI"].map(h => (
                        <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={9} className="text-center py-12 text-sm text-gray-400">Memuat laporan...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-sm text-gray-400">Tidak ada transaksi pada periode ini.</td></tr>
                    ) : transactions.map((trx, trxIndex) => (
                      trx.items.map((item, itemIndex) => (
                        <tr key={`${trx.id}-${item.productId}-${itemIndex}`} className="hover:bg-gray-50 transition-colors align-top">
                          {itemIndex === 0 && (
                            <>
                              <td rowSpan={trx.items.length} className="px-4 py-3 text-sm text-gray-500">{trxIndex + 1}</td>
                              <td rowSpan={trx.items.length} className="px-4 py-3 text-xs text-gray-500">
                                {new Date(trx.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </td>
                              <td rowSpan={trx.items.length} className="px-4 py-3 text-sm text-gray-700">
                                {new Date(trx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td rowSpan={trx.items.length} className="px-4 py-3">
                                <div className="space-y-1">
                                  <p className="text-xs font-mono text-gray-500">{trx.id.slice(0, 8)}...</p>
                                  {trx.discountAmount ? (
                                    <p className="text-[10px] text-green-600">Diskon {fmtFull(trx.discountAmount)}</p>
                                  ) : null}
                                  <p className="text-[10px] text-gray-400 uppercase">{trx.paymentMethod ?? "cash"}</p>
                                  <span
                                    className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      (trx.status ?? "COMPLETED") === "VOID"
                                        ? "bg-red-50 text-red-600"
                                        : (trx.status ?? "COMPLETED") === "REFUNDED"
                                          ? "bg-blue-50 text-blue-600"
                                          : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {(trx.status ?? "COMPLETED") === "VOID"
                                      ? "VOID"
                                      : (trx.status ?? "COMPLETED") === "REFUNDED"
                                        ? "REFUND"
                                        : "SELESAI"}
                                  </span>
                                  {trx.voidReason ? (
                                    <p className="text-[10px] text-red-400">Alasan: {trx.voidReason}</p>
                                  ) : null}
                                  {trx.refundReason ? (
                                    <p className="text-[10px] text-blue-400">Alasan: {trx.refundReason}</p>
                                  ) : null}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div>
                              <p>{item.product?.name ?? "-"}</p>
                              {item.note?.trim() && (
                                <p className="text-[10px] text-gray-400 mt-0.5">Catatan: {item.note}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.qty}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{fmtFull(item.price)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-amber-700">{fmtFull(item.qty * item.price)}</td>
                          {itemIndex === 0 && (
                            <td rowSpan={trx.items.length} className="px-4 py-3">
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-800">{fmtFull(trx.total)}</p>
                                <button
                                  onClick={() => printTransaction(trx)}
                                  className="px-3 py-1.5 text-[11px] font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Cetak Ulang
                                </button>
                                {(trx.status ?? "COMPLETED") === "COMPLETED" && (
                                  <>
                                    <button
                                      onClick={() => handleTransactionAction(trx, "VOID")}
                                      className="px-3 py-1.5 text-[11px] font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                      Void
                                    </button>
                                    <button
                                      onClick={() => handleTransactionAction(trx, "REFUND")}
                                      className="px-3 py-1.5 text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                      Refund
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ))}
                  </tbody>
                  {rows.length > 0 && summary && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={8} className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Total Omzet</td>
                        <td className="px-4 py-3 text-sm font-medium text-amber-700">{fmtFull(summary.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB: PRODUK LAKU */}
          {activeTab === "produkLaku" && (
            <ProdukLakuTab topProducts={topProducts} transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {/* TAB: BARANG LAMBAT */}
          {activeTab === "barangLambat" && (
            <BarangLambatTab slowProducts={slowProducts} dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {/* TAB: AUDIT */}
          {activeTab === "audit" && (
            <AuditTab transactions={transactions} summary={summary} topProducts={topProducts} dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {/* TAB: PAJAK */}
          {activeTab === "pajak" && (
            <PajakTab summary={summary} topProducts={topProducts} transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
          )}
        </div>
      </div>
    </div>
  );
}
