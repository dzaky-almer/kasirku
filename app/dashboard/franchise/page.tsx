"use client";

import { useState } from "react";

type StoreStatus = "active" | "warning";

interface Store {
  id: string;
  name: string;
  type: string;
  location: string;
  status: StoreStatus;
  omzet: number;
  transaksi: number;
  produk: number;
  stokStatus: "Aman" | "Menipis";
}

interface Transaction {
  storeName: string;
  time: string;
  amount: number;
}

const stores: Store[] = [
  {
    id: "1",
    name: "Barber Pusat",
    type: "Barber Shop",
    location: "Jakarta Selatan",
    status: "active",
    omzet: 6200000,
    transaksi: 412,
    produk: 24,
    stokStatus: "Aman",
  },
  {
    id: "2",
    name: "Warkop Timur",
    type: "Kafe",
    location: "Jakarta Timur",
    status: "active",
    omzet: 5100000,
    transaksi: 388,
    produk: 31,
    stokStatus: "Aman",
  },
  {
    id: "3",
    name: "Toko Barat",
    type: "Retail",
    location: "Tangerang",
    status: "warning",
    omzet: 4300000,
    transaksi: 295,
    produk: 18,
    stokStatus: "Menipis",
  },
  {
    id: "4",
    name: "Barber Utara",
    type: "Barber Shop",
    location: "Jakarta Utara",
    status: "active",
    omzet: 2800000,
    transaksi: 145,
    produk: 20,
    stokStatus: "Aman",
  },
];

const recentTransactions: Transaction[] = [
  { storeName: "Barber Pusat", time: "Hari ini, 14:22", amount: 85000 },
  { storeName: "Warkop Timur", time: "Hari ini, 13:58", amount: 42000 },
  { storeName: "Toko Barat", time: "Hari ini, 13:11", amount: 120000 },
  { storeName: "Barber Utara", time: "Hari ini, 12:45", amount: 75000 },
  { storeName: "Barber Pusat", time: "Hari ini, 11:30", amount: 95000 },
];

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function FranchiseDashboardPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("1");

  const totalOmzet = stores.reduce((sum, s) => sum + s.omzet, 0);
  const totalTransaksi = stores.reduce((sum, s) => sum + s.transaksi, 0);
  const tokobermasalah = stores.filter((s) => s.status === "warning").length;
  const maxOmzet = Math.max(...stores.map((s) => s.omzet));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
            <svg
              viewBox="0 0 18 18"
              className="w-5 h-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
              <rect
                x="10"
                y="2"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.6"
              />
              <rect
                x="2"
                y="10"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.6"
              />
              <rect
                x="10"
                y="10"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.4"
              />
            </svg>
          </div>
          <span className="text-base font-medium text-gray-900">
            Kasir<span className="text-emerald-500">Ku</span>
          </span>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
            Franchise Owner
          </span>
        </div>
        <span className="text-xs text-gray-400">Apr 2026</span>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Toko</p>
          <p className="text-2xl font-medium text-gray-900">{stores.length}</p>
          <p className="text-xs text-emerald-600 mt-1">+1 bulan ini</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Omzet Bulan Ini</p>
          <p className="text-2xl font-medium text-gray-900">
            {formatRupiah(totalOmzet)}
          </p>
          <p className="text-xs text-emerald-600 mt-1">+12% vs lalu</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Transaksi</p>
          <p className="text-2xl font-medium text-gray-900">
            {totalTransaksi.toLocaleString("id-ID")}
          </p>
          <p className="text-xs text-emerald-600 mt-1">+8% vs lalu</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Toko Bermasalah</p>
          <p className="text-2xl font-medium text-gray-900">{tokobermasalah}</p>
          <p className="text-xs text-orange-500 mt-1">stok menipis</p>
        </div>
      </div>

      {/* Store Cards */}
      <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
        CABANG TOKO
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {stores.map((store) => (
          <div
            key={store.id}
            onClick={() => setSelectedStoreId(store.id)}
            className={`bg-white rounded-xl p-4 cursor-pointer transition-all ${
              selectedStoreId === store.id
                ? "border-2 border-emerald-500"
                : "border border-gray-100 hover:border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{store.name}</p>
                <p className="text-xs text-gray-400">
                  {store.type} · {store.location}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  store.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {store.status === "active" ? "Aktif" : "Perhatian"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400">Omzet</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatRupiah(store.omzet)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Transaksi</p>
                <p className="text-sm font-medium text-gray-900">
                  {store.transaksi}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Produk</p>
                <p className="text-sm font-medium text-gray-900">
                  {store.produk}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Status Stok</p>
                <p
                  className={`text-sm font-medium ${
                    store.stokStatus === "Aman"
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`}
                >
                  {store.stokStatus}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
            TRANSAKSI TERBARU
          </p>
          <div className="divide-y divide-gray-50">
            {recentTransactions.map((txn, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {txn.storeName}
                  </p>
                  <p className="text-xs text-gray-400">{txn.time}</p>
                </div>
                <span className="text-sm font-medium text-emerald-600">
                  +{formatRupiah(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Omzet Ranking */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">
            PERINGKAT OMZET
          </p>
          <div className="divide-y divide-gray-50">
            {stores
              .slice()
              .sort((a, b) => b.omzet - a.omzet)
              .map((store, i) => (
                <div key={store.id} className="flex items-center gap-3 py-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-1">{store.name}</p>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.round((store.omzet / maxOmzet) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500 min-w-[52px] text-right">
                    {formatRupiah(store.omzet)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}