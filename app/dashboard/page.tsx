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
interface DashTop { name: string; sold: number; revenue: number; }

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

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();
  const storeId = (session?.user as any)?.storeId ?? demoStoreId;

  const [recentTxns, setRecentTxns] = useState<DashTxn[]>(emptyTxn);
  const [stockList, setStockList] = useState<DashStock[]>(emptyStock);
  const [topProducts, setTopProducts] = useState<DashTop[]>(emptyTop);
  const [salesData, setSalesData] = useState<number[]>(emptySales);
  const [allTodayTxns, setAllTodayTxns] = useState<any[]>([]);
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
            if (!Array.isArray(data)) return 0;
            return data.reduce((sum, t) => sum + (t.total ?? 0), 0);
          })
          .catch(() => 0)
      )
    ).then((revenues) => {
      setSalesData(revenues);

      fetch(`/api/transactions?storeId=${storeId}&date=${today}`)
        .then((r) => r.json())
        .then((data: any[]) => {
          if (!Array.isArray(data)) return;
          setAllTodayTxns(data);
          const recent = data.slice(0, 5).map((t) => ({
            item: t.items?.length > 0 ? `${t.items[0].qty}x item` : `Transaksi`,
            time: new Date(t.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit", minute: "2-digit",
            }),
            qty: (t.items as any[])?.reduce((s: number, i: any) => s + i.qty, 0) ?? 0,
            amount: t.total,
          }));
          setRecentTxns(recent);
        })
        .catch(console.error);
    });

    fetch(`/api/products?storeId=${storeId}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const stocks = data.map((p) => ({
          name: p.name,
          stock: p.stock,
          unit: p.unit ?? "pcs",
          status: p.stock <= (p.minStock ?? 5) ? "warn" : "ok",
        }));
        setStockList(stocks);
      })
      .catch(console.error);

    fetch(`/api/reports?storeId=${storeId}&date=${today}`)
      .then((r) => r.json())
      .then((data: any) => {
        if (Array.isArray(data.transactions)) {
          const productMap: Record<string, { name: string; sold: number; revenue: number }> = {};
          for (const trx of data.transactions) {
            for (const item of trx.items ?? []) {
              const key = item.productId;
              if (!productMap[key]) {
                productMap[key] = { name: item.product?.name ?? item.productId, sold: 0, revenue: 0 };
              }
              productMap[key].sold += item.qty;
              productMap[key].revenue += item.qty * item.price;
            }
          }
          const tops = Object.values(productMap)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5);
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

  const chartData = salesLabels.map((label, i) => ({
    name: label,
    omzet: salesData[i],
  }));

  const CustomDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    if (index === 0) {
      return <circle cx={cx} cy={cy} r={5} fill="#BA7517" stroke="#fff" strokeWidth={2.5} />;
    }
    const isUp = chartData[index].omzet >= chartData[index - 1].omzet;
    return (
      <circle cx={cx} cy={cy} r={5}
        fill={isUp ? "#16a34a" : "#dc2626"}
        stroke="#fff" strokeWidth={2.5}
      />
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {(session?.user as any)?.email ?? (isDemoMode ? "demo@tokoku.local" : "Kopi Nusantara")}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {getToday()}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Omzet hari ini</p>
              <p className="text-xl font-medium text-gray-900">{formatRupiah(totalOmzet)}</p>
              <p className="text-xs text-gray-400 mt-1">dari transaksi hari ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Transaksi</p>
              <p className="text-xl font-medium text-gray-900">{totalTxn}</p>
              <p className="text-xs text-gray-400 mt-1">transaksi tercatat</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Item terjual</p>
              <p className="text-xl font-medium text-gray-900">{totalItemTerjual}</p>
              <p className="text-xs text-gray-400 mt-1">item hari ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Stok hampir habis</p>
              <p className="text-xl font-medium text-gray-900">{stokWarn}</p>
              <p className={`text-xs mt-1 ${stokWarn > 0 ? "text-red-500" : "text-gray-400"}`}>
                {stokWarn > 0 ? "perlu restock" : "semua aman"}
              </p>
            </div>
          </div>

          {/* Chart + Transaksi */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="col-span-2 bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-5">
                  PENJUALAN 7 HARI TERAKHIR
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
                      tickFormatter={(v) => formatRupiah(v)}
                      width={64}
                    />

                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "rgba(186,117,23,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />

                    <Area
                      type="monotone"
                      dataKey="omzet"
                      stroke="#BA7517"
                      strokeWidth={2.5}
                      fill="url(#omzetFill)"
                      dot={<CustomDot />}
                      activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2.5 }}
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaksi terbaru */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
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

          <div className="grid grid-cols-3 gap-3">
            {/* Stok */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">STOK PRODUK</p>
              {stockList.length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada produk.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {stockList.slice(0, 6).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-xs text-gray-800 truncate max-w-[120px]">{p.name}</p>
                        <p className="text-[10px] text-gray-400">Sisa: {p.stock} {p.unit}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.status === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {p.status === "ok" ? "Aman" : "Menipis"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produk terlaris */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">MENU TERLARIS HARI INI</p>
              {topProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Belum ada penjualan hari ini.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-xs text-gray-800 truncate max-w-[120px]">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.sold} terjual</p>
                      </div>
                      <span className="text-xs font-medium text-amber-700">
                        {formatRupiah(p.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/kasir")}
                className="bg-amber-700 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-amber-800 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
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
                onClick={() => router.push("/product")}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left"
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
                onClick={() => router.push("/laporan")}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left"
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
