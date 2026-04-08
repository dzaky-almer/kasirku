"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Tipe data internal dashboard
interface DashTxn { item: string; time: string; qty: number; amount: number; }
interface DashStock { name: string; stock: number; unit: string; status: string; }
interface DashTop { name: string; sold: number; revenue: number; }

// Fallback saat data belum ada
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

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [recentTxns, setRecentTxns] = useState<DashTxn[]>(emptyTxn);
  const [stockList, setStockList] = useState<DashStock[]>(emptyStock);
  const [topProducts, setTopProducts] = useState<DashTop[]>(emptyTop);
  const [salesData, setSalesData] = useState<number[]>(emptySales);
  const salesLabels = getLast7Labels();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (status === "loading") return;
  if (!storeId) return;
 
  const today = new Date().toISOString().split("T")[0];
 
  // Hitung tanggal 7 hari terakhir
  const last7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0]; // "2026-04-01"
  });
 
  // 1. Fetch transaksi 7 hari terakhir sekaligus
  // Fetch per hari paralel
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
    setSalesData(revenues); // [omzet hari-1, ..., omzet hari ini]
 
    // Hitung metric dari transaksi hari ini (index terakhir)
    // Fetch ulang transaksi hari ini untuk recent list
    fetch(`/api/transactions?storeId=${storeId}&date=${today}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
 
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
 
  // 2. Fetch produk untuk stok
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
 
  // 3. Fetch laporan hari ini untuk top produk
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

  // Metric cards
  const totalOmzet = salesData[6];
  const totalTxn = recentTxns.length;
  const totalItemTerjual = recentTxns.reduce((a, t) => a + t.qty, 0);
  const stokWarn = stockList.filter((p) => p.status === "warn").length;
  const maxSales = Math.max(...salesData, 1);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {(session?.user as any)?.email ?? "Kopi Nusantara"}
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
            <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                PENJUALAN 7 HARI TERAKHIR
              </p>
              <div className="flex items-end gap-2 h-36">
                {salesData.map((val, i) => {
                  const isToday = i === 6;
                  const heightPct = Math.max(Math.round((val / maxSales) * 100), val > 0 ? 4 : 0);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "112px" }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${isToday ? "bg-amber-700" : "bg-amber-200"}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">
                        {salesLabels[i]?.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
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
                        p.status === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
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