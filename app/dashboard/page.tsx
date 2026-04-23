"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

interface DashTxn { item: string; time: string; qty: number; amount: number; }
interface DashStock { name: string; stock: number; unit: string; status: string; }
interface DashTop { name: string; sold: number; revenue: number; profit: number; }

interface StockTurnover {
  name: string;
  stock: number;
  unit: string;
  soldLast7Days: number;
  turnoverDays: number;
  status: "fast" | "slow" | "dead" | "ok";
}

const emptyTxn: DashTxn[] = [];
const emptyStock: DashStock[] = [];
const emptyTop: DashTop[] = [];
const emptySales = [0, 0, 0, 0, 0, 0, 0];

function getLast7Labels(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  });
}

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function getToday(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

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
      <p style={{ color: "#9ca3af", margin: "0 0 4px 0" }}>Tanggal: {label}</p>
      <p style={{ color: "#f59e0b", margin: 0, fontWeight: 600, fontSize: "14px" }}>
        {formatRupiah(payload[0].value as number)}
      </p>
    </div>
  );
};

// ── Komponen peringatan stok compact (1 baris, bisa expand) ──
function StockWarningBar({ fastStock, slowStock, deadStock }: {
  fastStock: StockTurnover[];
  slowStock: StockTurnover[];
  deadStock: StockTurnover[];
}) {
  const [open, setOpen] = useState(false);
  const total = fastStock.length + slowStock.length + deadStock.length;

  return (
    <div className="mb-4">
      {/* Baris ringkas */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 hover:border-gray-200 transition-colors text-left shadow-lg"
      >
        <span className="text-sm">⚠️</span>
        <span className="text-xs text-gray-600 font-medium flex-1">
          Peringatan perputaran stok
        </span>
        {fastStock.length > 0 && (
          <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
            {fastStock.length} cepat habis
          </span>
        )}
        {deadStock.length > 0 && (
          <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
            {deadStock.length} tidak laku
          </span>
        )}
        {slowStock.length > 0 && (
          <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
            {slowStock.length} lambat
          </span>
        )}
        <svg
          viewBox="0 0 16 16" className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Detail saat di-expand */}
      {open && (
        <div className="mt-1 bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap gap-2">
          {fastStock.map((p, i) => (
            <div key={`f${i}`} className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="text-[11px] text-orange-700 font-medium">{p.name}</span>
              <span className="text-[10px] text-orange-400">~{p.turnoverDays} hari</span>
            </div>
          ))}
          {deadStock.map((p, i) => (
            <div key={`d${i}`} className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-[11px] text-red-700 font-medium">{p.name}</span>
              <span className="text-[10px] text-red-400">0 terjual/7hr</span>
            </div>
          ))}
          {slowStock.map((p, i) => (
            <div key={`s${i}`} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-[11px] text-blue-700 font-medium">{p.name}</span>
              <span className="text-[10px] text-blue-400">{p.soldLast7Days} terjual/7hr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();
  const storeId = isDemoMode ? demoStoreId : (session?.user as any)?.storeId ?? "";
  const pushWithMode = (href: string) => router.push(isDemoMode ? `${href}?demo=true` : href);

  const [recentTxns, setRecentTxns] = useState<DashTxn[]>(emptyTxn);
  const [stockList, setStockList] = useState<DashStock[]>(emptyStock);
  const [topProducts, setTopProducts] = useState<DashTop[]>(emptyTop);
  const [salesData, setSalesData] = useState<number[]>(emptySales);
  const [allTodayTxns, setAllTodayTxns] = useState<any[]>([]);
  const [netProfit, setNetProfit] = useState(0);
  const [stockTurnover, setStockTurnover] = useState<StockTurnover[]>([]);
  const salesLabels = getLast7Labels();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!storeId) return;

    const today = new Date().toISOString().split("T")[0];

    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    Promise.all(
      last7Dates.map((date) =>
        fetch(`/api/transactions?storeId=${storeId}&date=${date}`)
          .then((r) => r.json())
          .then((data: any[]) => {
            if (!Array.isArray(data)) return { revenue: 0, cogs: 0, soldMap: {} as Record<string, number> };
            const revenue = data.reduce((sum, t) => sum + (t.total ?? 0), 0);
            const cogs = data.reduce((sum, t) =>
              sum + (t.items ?? []).reduce((s: number, item: any) =>
                s + (item.qty ?? 0) * (item.costPrice ?? item.product?.costPrice ?? 0), 0), 0);
            const soldMap: Record<string, number> = {};
            for (const t of data) {
              for (const item of t.items ?? []) {
                soldMap[item.productId] = (soldMap[item.productId] ?? 0) + (item.qty ?? 0);
              }
            }
            return { revenue, cogs, soldMap };
          })
          .catch(() => ({ revenue: 0, cogs: 0, soldMap: {} as Record<string, number> }))
      )
    ).then((results) => {
      setSalesData(results.map((r) => r.revenue));

      // Keuntungan bersih hari ini (index 6 = hari ini)
      const todayResult = results[6];
      setNetProfit(todayResult.revenue - todayResult.cogs);

      // Gabungkan soldMap 7 hari untuk analisis perputaran
      const totalSoldMap: Record<string, number> = {};
      for (const r of results) {
        for (const [id, qty] of Object.entries(r.soldMap)) {
          totalSoldMap[id] = (totalSoldMap[id] ?? 0) + qty;
        }
      }

      // Fetch produk untuk hitung turnover stok
      fetch(`/api/products?storeId=${storeId}`)
        .then((r) => r.json())
        .then((products: any[]) => {
          if (!Array.isArray(products)) return;

          const stocks: DashStock[] = products.map((p) => ({
            name: p.name,
            stock: p.stock,
            unit: p.unit ?? "pcs",
            status: p.stock <= (p.minStock ?? 5) ? "warn" : "ok",
          }));
          setStockList(stocks);

          const turnoverData: StockTurnover[] = products.map((p) => {
            const sold7 = totalSoldMap[p.id] ?? 0;
            const avgPerDay = sold7 / 7;
            const stock = p.stock ?? 0;
            let turnoverDays = 0;
            let status: StockTurnover["status"] = "ok";

            if (sold7 === 0) {
              status = "dead";
              turnoverDays = 999;
            } else {
              turnoverDays = avgPerDay > 0 ? Math.round(stock / avgPerDay) : 999;
              if (turnoverDays <= 3) status = "fast";
              else if (turnoverDays >= 30) status = "slow";
              else status = "ok";
            }

            return { name: p.name, stock, unit: p.unit ?? "pcs", soldLast7Days: sold7, turnoverDays, status };
          });

          setStockTurnover(turnoverData);
        })
        .catch(console.error);

      // Transaksi hari ini
      fetch(`/api/transactions?storeId=${storeId}&date=${today}`)
        .then((r) => r.json())
        .then((data: any[]) => {
          if (!Array.isArray(data)) return;
          setAllTodayTxns(data);
          const recent = data.slice(0, 5).map((t) => ({
            item: t.items?.length > 0 ? `${t.items[0].qty}x item` : `Transaksi`,
            time: new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            qty: (t.items as any[])?.reduce((s: number, i: any) => s + i.qty, 0) ?? 0,
            amount: t.total,
          }));
          setRecentTxns(recent);
        })
        .catch(console.error);
    });

    fetch(`/api/reports?storeId=${storeId}&date=${today}`)
      .then((r) => r.json())
      .then((data: any) => {
        if (Array.isArray(data.transactions)) {
          const productMap: Record<string, { name: string; sold: number; revenue: number; profit: number }> = {};
          for (const trx of data.transactions) {
            for (const item of trx.items ?? []) {
              const key = item.productId;
              if (!productMap[key]) {
                productMap[key] = { name: item.product?.name ?? item.productId, sold: 0, revenue: 0, profit: 0 };
              }
              productMap[key].sold += item.qty;
              productMap[key].revenue += item.qty * item.price;
              productMap[key].profit += item.qty * (item.price - (item.costPrice ?? item.product?.costPrice ?? 0));
            }
          }
          const tops = Object.values(productMap).sort((a, b) => b.sold - a.sold).slice(0, 5);
          setTopProducts(tops);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  }, [storeId, status]);

  const totalOmzet = salesData[6];
  const totalTxn = allTodayTxns.length;
  const totalItemTerjual = recentTxns.reduce((a, t) => a + t.qty, 0);
  const stokWarn = stockList.filter((p) => p.status === "warn").length;

  const fastStock = stockTurnover.filter((p) => p.status === "fast");
  const slowStock = stockTurnover.filter((p) => p.status === "slow");
  const deadStock = stockTurnover.filter((p) => p.status === "dead");
  const hasStockWarnings = fastStock.length > 0 || slowStock.length > 0 || deadStock.length > 0;

  const sortedByLaku = [...stockTurnover].sort((a, b) => b.soldLast7Days - a.soldLast7Days);
  const produkLaku = sortedByLaku.slice(0, 5);
  const produkTidakLaku = stockTurnover
    .filter((p) => p.soldLast7Days === 0 || p.status === "slow" || p.status === "dead")
    .slice(0, 5);

  const chartData = salesLabels.map((label, i) => ({ name: label, omzet: salesData[i] }));

  const CustomDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    if (index === 0) {
      return <circle cx={cx} cy={cy} r={5} fill="#BA7517" stroke="#fff" strokeWidth={2.5} />;
    }
    const isUp = chartData[index].omzet >= chartData[index - 1].omzet;
    return <circle cx={cx} cy={cy} r={5} fill={isUp ? "#16a34a" : "#dc2626"} stroke="#fff" strokeWidth={2.5} />;
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-lg">
          <span className="text-sm font-medium text-gray-900">Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {isDemoMode ? "demo@tokoku.local" : (session?.user as any)?.email ?? "Kopi Nusantara"}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {getToday()}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* ── PERINGATAN PERPUTARAN STOK (compact) ── */}
          {hasStockWarnings && (
            <StockWarningBar
              fastStock={fastStock}
              slowStock={slowStock}
              deadStock={deadStock}
            />
          )}

          {/* ── METRIC CARDS (5 kartu) ── */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Omzet hari ini</p>
              <p className="text-xl font-medium text-gray-900">{formatRupiah(totalOmzet)}</p>
              <p className="text-xs text-gray-400 mt-1">dari transaksi hari ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Transaksi</p>
              <p className="text-xl font-medium text-gray-900">{totalTxn}</p>
              <p className="text-xs text-gray-400 mt-1">transaksi tercatat</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Item terjual</p>
              <p className="text-xl font-medium text-gray-900">{totalItemTerjual}</p>
              <p className="text-xs text-gray-400 mt-1">item hari ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Stok hampir habis</p>
              <p className="text-xl font-medium text-gray-900">{stokWarn}</p>
              <p className={`text-xs mt-1 ${stokWarn > 0 ? "text-red-500" : "text-gray-400"}`}>
                {stokWarn > 0 ? "perlu restock" : "semua aman"}
              </p>
            </div>
            {/* Keuntungan Bersih Real-time */}
            <div className={`rounded-xl p-4 border ${netProfit >= 0 ? "bg-emerald-50 border-emerald-100 shadow-lg" : "bg-red-50 border-red-100 shadow-lg"}`}>
              <p className="text-xs text-gray-400 mb-1">Keuntungan bersih</p>
              <p className={`text-xl font-medium ${netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatRupiah(Math.abs(netProfit))}
              </p>
              <p className={`text-xs mt-1 ${netProfit >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {netProfit >= 0 ? "untung hari ini" : "rugi hari ini"}
              </p>
            </div>
          </div>

          {/* ── CHART + TRANSAKSI ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="col-span-2 bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-5">PENJUALAN 7 HARI TERAKHIR</p>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />Naik
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />Turun
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-amber-700 inline-block" />Awal
                  </span>
                </div>
              </div>
              <div className="w-full h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="omzetFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.5}  />
                        <stop offset="60%"  stopColor="#BA7517" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#BA7517" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} tick={{ fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRupiah(v)} width={64} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(186,117,23,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                    <Area
                      type="monotone" dataKey="omzet" stroke="#BA7517" strokeWidth={2.5}
                      fill="url(#omzetFill)" dot={<CustomDot />}
                      activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2.5 }}
                      isAnimationActive={true} animationDuration={900} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">TRANSAKSI TERBARU</p>
              {loading ? (
                <p className="text-xs text-gray-400">Memuat...</p>
              ) : recentTxns.length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada transaksi hari ini.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentTxns.map((txn, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-800 truncate">{txn.item}</p>
                          <p className="text-[10px] text-gray-400">{txn.time} · {txn.qty} item</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-amber-700 ml-2 flex-shrink-0">
                        +{formatRupiah(txn.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── BARIS BAWAH: Stok + Laku + Tidak Laku + Actions ── */}
          <div className="grid grid-cols-4 gap-3">

            {/* Stok Produk */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">STOK PRODUK</p>
              {stockList.length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada produk.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {stockList.slice(0, 6).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-xs text-gray-800 truncate max-w-[100px]">{p.name}</p>
                        <p className="text-[10px] text-gray-400">Sisa: {p.stock} {p.unit}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.status === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}>
                        {p.status === "ok" ? "Aman" : "Menipis"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produk Paling Laku */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">PRODUK PALING LAKU</p>
              <p className="text-[10px] text-gray-400 mb-3">7 hari terakhir</p>
              {loading ? (
                <p className="text-xs text-gray-400">Memuat...</p>
              ) : produkLaku.filter(p => p.soldLast7Days > 0).length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada data penjualan.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {produkLaku.filter(p => p.soldLast7Days > 0).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold w-4 flex-shrink-0 ${
                          i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : "text-gray-300"
                        }`}>#{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-800 truncate max-w-[80px]">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.soldLast7Days} terjual</p>
                        </div>
                      </div>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, (p.soldLast7Days / (produkLaku[0]?.soldLast7Days || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produk Tidak Laku */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-1 ">PRODUK TIDAK LAKU</p>
              <p className="text-[10px] text-gray-400 mb-3">7 hari terakhir</p>
              {loading ? (
                <p className="text-xs text-gray-400">Memuat...</p>
              ) : produkTidakLaku.length === 0 ? (
                <p className="text-xs text-emerald-600">Semua produk terjual! 🎉</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {produkTidakLaku.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-800 truncate max-w-[100px]">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.soldLast7Days} terjual</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                        p.status === "dead" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      }`}>
                        {p.status === "dead" ? "tidak laku" : "Lambat"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => pushWithMode("/kasir")}
                className="bg-amber-700 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-amber-800 transition-colors text-left shadow-lg"
              >
                <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0 ">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                    <rect x="2" y="4" width="12" height="8" rx="1" stroke="white" />
                    <path d="M8 8v2M6 9h4" stroke="white" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Buka Kasir</p>
                  <p className="text-xs text-amber-200">Mulai transaksi baru</p>
                </div>
              </button>

              <button
                onClick={() => pushWithMode("/product")}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left shadow-lg"
              >
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                    <path d="M8 2L14 5v6L8 14 2 11V5z" stroke="#92400e" />
                    <path d="M8 2v12M2 5l6 3 6-3" stroke="#92400e" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">Kelola Menu</p>
                  <p className="text-[10px] text-gray-400">Tambah / edit produk</p>
                </div>
              </button>

              <button
                onClick={() => pushWithMode("/laporan")}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left shadow-lg"
              >
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                    <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="#92400e" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">Lihat Laporan</p>
                  <p className="text-[10px] text-gray-400">Penjualan & omzet</p>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}