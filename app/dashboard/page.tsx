"use client";

import { useState } from "react";

const recentTransactions = [
  { item: "Kopi Susu Gula Aren", time: "14:22", qty: 2, amount: 54000 },
  { item: "Americano Hot", time: "13:58", qty: 1, amount: 28000 },
  { item: "Matcha Latte + Croissant", time: "13:11", qty: 2, amount: 78000 },
  { item: "Es Kopi Hitam", time: "12:45", qty: 3, amount: 63000 },
  { item: "Cappuccino", time: "12:10", qty: 1, amount: 32000 },
];

const stockProducts = [
  { name: "Biji Kopi Arabika", stock: 3, unit: "kg", status: "warn" },
  { name: "Susu Full Cream", stock: 2, unit: "liter", status: "warn" },
  { name: "Gula Aren Cair", stock: 1, unit: "botol", status: "warn" },
  { name: "Matcha Powder", stock: 14, unit: "pcs", status: "ok" },
];

const topProducts = [
  { name: "Kopi Susu Gula Aren", sold: 148, revenue: 3996000 },
  { name: "Americano", sold: 96, revenue: 2688000 },
  { name: "Matcha Latte", sold: 72, revenue: 2520000 },
  { name: "Es Kopi Hitam", sold: 55, revenue: 1155000 },
];

const salesData = [820000, 1050000, 780000, 1300000, 960000, 1100000, 1200000];
const salesLabels = ["27 Mar", "28 Mar", "29 Mar", "30 Mar", "31 Mar", "1 Apr", "2 Apr"];

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

const navItems = [
  {
    label: "Dashboard",
    active: true,
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" />
      </svg>
    ),
  },
  {
    label: "Kasir",
    active: false,
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" />
        <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" />
        <path d="M8 8v2M6 9h4" stroke="currentColor" />
      </svg>
    ),
  },
  {
    label: "Produk",
    active: false,
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <path d="M8 2L14 5v6L8 14 2 11V5z" stroke="currentColor" />
        <path d="M8 2v12M2 5l6 3 6-3" stroke="currentColor" />
      </svg>
    ),
  },
  {
    label: "Laporan",
    active: false,
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="currentColor" />
      </svg>
    ),
  },
  {
    label: "Setting",
    active: false,
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <circle cx="8" cy="8" r="2" stroke="currentColor" />
        <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="currentColor" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState("Dashboard");

  const totalOmzet = salesData[salesData.length - 1];
  const totalTxn = 38;
  const totalItemTerjual = 84;
  const stokWarn = stockProducts.filter((p) => p.status === "warn").length;
  const maxSales = Math.max(...salesData);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 flex-shrink-0">
        <div className="w-8 h-8 bg-amber-700 rounded-lg flex items-center justify-center mb-3">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
            <path d="M4 12c0-3 1.5-5 4-5s4 2 4 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="8" cy="12.5" rx="4" ry="1.5" stroke="white" strokeWidth="1.2" />
          </svg>
        </div>

        {navItems.map((nav) => (
          <button
            key={nav.label}
            onClick={() => setActiveNav(nav.label)}
            title={nav.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === nav.label
                ? "bg-amber-50 text-amber-800"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {nav.icon}
          </button>
        ))}

        <div className="flex-1" />
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-medium text-amber-800">
          AK
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Nav */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              Kopi Nusantara
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              Rabu, 2 Apr 2026
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Omzet hari ini</p>
              <p className="text-xl font-medium text-gray-900">{formatRupiah(totalOmzet)}</p>
              <p className="text-xs text-emerald-600 mt-1">+18% vs kemarin</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Transaksi</p>
              <p className="text-xl font-medium text-gray-900">{totalTxn}</p>
              <p className="text-xs text-emerald-600 mt-1">+5 vs kemarin</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Menu terjual</p>
              <p className="text-xl font-medium text-gray-900">{totalItemTerjual}</p>
              <p className="text-xs text-gray-400 mt-1">item hari ini</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Stok hampir habis</p>
              <p className="text-xl font-medium text-gray-900">{stokWarn}</p>
              <p className="text-xs text-red-500 mt-1">perlu restock</p>
            </div>
          </div>

          {/* Chart + Transaksi */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {/* Chart */}
            <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">
                PENJUALAN 7 HARI TERAKHIR
              </p>
              <div className="flex items-end gap-2 h-36">
                {salesData.map((val, i) => {
                  const isToday = i === salesData.length - 1;
                  const heightPct = Math.round((val / maxSales) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "112px" }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            isToday ? "bg-amber-700" : "bg-amber-200"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap">
                        {salesLabels[i].split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                {salesLabels.map((label, i) => (
                  <span key={i} className="text-[9px] text-gray-300 flex-1 text-center">
                    {i === salesData.length - 1 ? (
                      <span className="text-amber-700 font-medium">{formatRupiah(salesData[i])}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>

            {/* Transaksi terbaru */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
                TRANSAKSI TERBARU
              </p>
              <div className="divide-y divide-gray-50">
                {recentTransactions.map((txn, i) => (
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
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Stok */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
                STOK BAHAN
              </p>
              <div className="divide-y divide-gray-50">
                {stockProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs text-gray-800">{p.name}</p>
                      <p className="text-[10px] text-gray-400">
                        Sisa: {p.stock} {p.unit}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.status === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {p.status === "ok" ? "Aman" : "Menipis"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Produk terlaris */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
                MENU TERLARIS
              </p>
              <div className="divide-y divide-gray-50">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs text-gray-800">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.sold} terjual</p>
                    </div>
                    <span className="text-xs font-medium text-amber-700">
                      {formatRupiah(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <button className="bg-amber-700 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-amber-800 transition-colors text-left">
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

              <button className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left">
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

              <button className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors text-left">
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