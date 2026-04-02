"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
}

interface CartItem extends Product {
  qty: number;
}

const categories = ["Semua", "Kopi", "Non-Kopi", "Makanan"];

function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

export default function KasirPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paid, setPaid] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/products?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
      })
      .catch(() => console.error("Gagal fetch produk"));
  }, [storeId]);

  const filtered = products.filter((p) => {
    const matchCat =
      activeCategory === "Semua" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.id === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setPaid("");
    setSuccess(false);
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;
  const paidNum = parseInt(paid.replace(/\D/g, "")) || 0;
  const kembalian = paidNum - total;

  async function handleBayar() {
    if (cart.length === 0 || paidNum < total || !storeId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          items: cart.map((item) => ({
            productId: item.id,
            qty: item.qty,
            price: item.price,
          })),
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan transaksi");
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Transaksi gagal disimpan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Kasir</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              Kopi Nusantara ·{" "}
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
        </header>

        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
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
              placeholder="Cari menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-amber-700 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!storeId ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Memuat sesi...
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Memuat produk...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Produk tidak ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((product) => {
                const inCart = cart.find((c) => c.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                    className={`bg-white border rounded-xl p-4 text-left hover:border-amber-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      inCart ? "border-amber-400" : "border-gray-100"
                    }`}
                  >
                    <div className="text-2xl mb-2">🛍️</div>
                    <p className="text-xs font-medium text-gray-800 leading-tight mb-1">
                      {product.name}
                    </p>
                    <p className="text-xs text-amber-700 font-medium">
                      {formatRupiah(product.price)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Stok: {product.stock}
                    </p>
                    {inCart && (
                      <div className="mt-2">
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          {inCart.qty} di keranjang
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Pesanan</span>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Kosongkan
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-gray-300"
                  fill="none"
                  strokeWidth={1.5}
                >
                  <path
                    d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                    stroke="currentColor"
                  />
                  <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">Belum ada pesanan</p>
              <p className="text-[10px] text-gray-300 mt-1">
                Pilih menu di sebelah kiri
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cart.map((item) => (
                <div key={item.id} className="py-3 flex items-center gap-3">
                  <span className="text-lg">🛍️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatRupiah(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 text-sm font-medium transition-colors"
                    >
                      −
                    </button>
                    <span className="text-xs font-medium text-gray-800 w-4 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 hover:bg-amber-200 text-sm font-medium transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs font-medium text-gray-700 min-w-[56px] text-right">
                    {formatRupiah(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Pajak (10%)</span>
                <span>{formatRupiah(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-amber-700">{formatRupiah(total)}</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[10px] text-gray-400 mb-1 block">
                Uang diterima
              </label>
              <input
                type="text"
                placeholder="Rp 0"
                value={paid}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setPaid(
                    raw ? "Rp " + parseInt(raw).toLocaleString("id-ID") : ""
                  );
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
              />
              {paidNum > 0 && paidNum >= total && (
                <p className="text-xs text-emerald-600 mt-1">
                  Kembalian: {formatRupiah(kembalian)}
                </p>
              )}
              {paidNum > 0 && paidNum < total && (
                <p className="text-xs text-red-500 mt-1">
                  Kurang: {formatRupiah(total - paidNum)}
                </p>
              )}
            </div>

            <button
              onClick={handleBayar}
              disabled={cart.length === 0 || paidNum < total || loading}
              className="w-full py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Menyimpan..." : "Proses Pembayaran"}
            </button>
          </div>
        )}
      </aside>

      {success && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={clearCart}
        >
          <div
            className="bg-white rounded-2xl p-8 w-80 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                viewBox="0 0 24 24"
                className="w-7 h-7 text-emerald-500"
                fill="none"
                strokeWidth={2}
              >
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-900 mb-1">
              Pembayaran Berhasil
            </p>
            <p className="text-sm text-gray-400 mb-1">
              Total: {formatRupiah(total)}
            </p>
            <p className="text-sm text-emerald-600 mb-6">
              Kembalian: {formatRupiah(kembalian)}
            </p>
            <button
              onClick={clearCart}
              className="w-full py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors mb-2"
            >
              Transaksi Berikutnya
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-2.5 bg-white text-gray-500 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}