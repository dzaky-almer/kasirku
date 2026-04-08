"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Script from "next/script";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  imageUrl?: string;
}

interface CartItem extends Product {
  qty: number;
}

function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

declare global {
  interface Window { snap: any; }
}

export default function KasirPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";
  const userId = session?.user?.id ?? "";
  const strutRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const categories = useMemo(() => [
    "Semua",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])),
  ], [products]);

  const [activeCategory, setActiveCategory] = useState("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paid, setPaid] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [qrisLoading, setQrisLoading] = useState(false);
  const [showStruk, setShowStruk] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/products?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setProducts(data); })
      .catch(() => console.error("Gagal fetch produk"));
  }, [storeId]);

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "Semua" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) return prev.map((c) => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...product, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0)
    );
  }

  function setQtyDirect(id: string, val: string) {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    if (num === 0) {
      setCart((prev) => prev.filter((c) => c.id !== id));
    } else {
      setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: num } : c));
    }
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function clearCart() {
    setCart([]);
    setPaid("");
    setSuccess(false);
    setShowStruk(false);
    setPaymentMethod("cash");
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;
  const paidNum = parseInt(paid.replace(/\D/g, "")) || 0;
  const kembalian = paidNum - total;

 function printStruk() {
  const now = new Date();
  const trxTime = now.toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  const itemRows = cart.map((item) =>
    `<tr>
      <td style="padding:1px 0">${item.name}</td>
      <td style="text-align:right;white-space:nowrap">${item.qty} x ${formatRupiah(item.price)}</td>
    </tr>
    <tr>
      <td colspan="2" style="text-align:right;padding-bottom:3px">${formatRupiah(item.price * item.qty)}</td>
    </tr>`
  ).join("");

  const cashRows = paymentMethod === "cash" ? `
    <tr><td>Tunai</td><td style="text-align:right">${formatRupiah(paidNum)}</td></tr>
    <tr><td>Kembali</td><td style="text-align:right">${formatRupiah(kembalian)}</td></tr>
  ` : `<tr><td colspan="2" style="text-align:center">-- Dibayar via QRIS --</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Struk</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 8px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
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
    <div class="store-name">KOPI NUSANTARA</div>
    <div>Jl. Kopi No. 1, Jakarta</div>
    <div>Telp: 021-12345678</div>
  </div>
  <div class="divider-solid"></div>
  <table>
    <tr><td>No. Transaksi</td><td style="text-align:right">#${trxId.toUpperCase()}</td></tr>
    <tr><td>Tanggal</td><td style="text-align:right">${trxTime}</td></tr>
    <tr><td>Kasir</td><td style="text-align:right">${session?.user?.name ?? "Kasir"}</td></tr>
  </table>
  <div class="divider-dash"></div>
  <table>${itemRows}</table>
  <div class="divider-dash"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(subtotal)}</td></tr>
    <tr><td>PPN 10%</td><td style="text-align:right">${formatRupiah(tax)}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatRupiah(total)}</td></tr>
  </table>
  <div class="divider-dash"></div>
  <table>
    <tr><td>Metode Bayar</td><td style="text-align:right">${paymentMethod === "cash" ? "TUNAI" : "QRIS"}</td></tr>
    ${cashRows}
  </table>
  <div class="divider-solid"></div>
  <div class="footer">
    <div>*** TERIMA KASIH ***</div>
    <div>Barang yang sudah dibeli</div>
    <div>tidak dapat dikembalikan</div>
    <div style="margin-top:4px;font-size:10px">Powered by KasirKu</div>
  </div>
</body></html>`;

  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

  async function saveTransaction(method: "cash" | "qris") {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId, userId, paymentMethod: method,
        items: cart.map((item) => ({ productId: item.id, qty: item.qty, price: item.price })),
      }),
    });

    if (res.status === 403) {
      alert("Langganan kamu sudah habis. Perpanjang untuk melanjutkan.");
      router.push("/pricing");
      return false;
    }

    if (!res.ok) throw new Error("Gagal menyimpan transaksi");
    const data = await res.json();
    setLastTransaction(data);
    return true;
  }

  async function handleBayar() {
    if (cart.length === 0 || !storeId || !userId) return;

    if (paymentMethod === "cash") {
      if (paidNum < total) return;
      setLoading(true);
      try {
        await saveTransaction("cash");
        setSuccess(true); setShowStruk(true);
setTimeout(() => printStruk(), 400);
      } catch (err) {
        console.error(err);
        alert("Transaksi gagal disimpan. Coba lagi.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setQrisLoading(true);
    try {
      const orderId = `TRX-${Date.now()}`;
      const res = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate QRIS");

      window.snap.pay(data.token, {
        onSuccess: async () => {
  await saveTransaction("qris");
  setSuccess(true); setShowStruk(true);
  setTimeout(() => printStruk(), 400);
},
        onPending: () => { alert("Pembayaran pending."); },
        onError: () => { alert("Pembayaran gagal. Coba lagi."); },
        onClose: () => {},
      });
    } catch (err) {
      console.error(err);
      alert("Gagal generate QRIS. Coba lagi.");
    } finally {
      setQrisLoading(false);
    }
  }

  const now = new Date();
  const trxId = lastTransaction?.id?.slice(0, 8) ?? "—";
  const trxTime = now.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} strategy="lazyOnload" />

      <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-gray-900">Kasir</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span>
              <button onClick={() => router.push("/dashboard")} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                ← Dashboard
              </button>
            </div>
          </header>

          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" strokeWidth={1.5}>
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Cari menu..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 transition-colors" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!storeId ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Memuat sesi...</div>
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Memuat produk...</div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Produk tidak ditemukan.</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filtered.map((product) => {
                  const inCart = cart.find((c) => c.id === product.id);
                  return (
                    <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock === 0}
                      className={`bg-white border rounded-xl overflow-hidden text-left hover:border-amber-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${inCart ? "border-amber-400" : "border-gray-100"}`}>
                      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🛍️</span>
                        )}
                      </div>
                      <div className="p-2 text-center">
                        <p className="text-[11px] font-medium text-gray-800 leading-tight mb-0.5 truncate">{product.name}</p>
                        <p className="text-[11px] text-amber-700 font-medium">{formatRupiah(product.price)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Stok: {product.stock}</p>
                        {inCart && (
                          <div className="mt-1">
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{inCart.qty} di keranjang</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <aside className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">Pesanan</span>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Kosongkan</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300" fill="none" strokeWidth={1.5}>
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" />
                    <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">Belum ada pesanan</p>
                <p className="text-[10px] text-gray-300 mt-1">Pilih menu di sebelah kiri</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cart.map((item) => (
                  <div key={item.id} className="py-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">🛍️</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{formatRupiah(item.price)}</p>
                    </div>
                    {/* Qty control dengan input ketik */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 text-sm font-medium transition-colors">
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => setQtyDirect(item.id, e.target.value)}
                        className="w-8 h-6 text-center text-xs font-medium text-gray-800 border border-gray-200 rounded outline-none focus:border-amber-400"
                      />
                      <button onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 hover:bg-amber-200 text-sm font-medium transition-colors">
                        +
                      </button>
                    </div>
                    <span className="text-xs font-medium text-gray-700 min-w-[50px] text-right">{formatRupiah(item.price * item.qty)}</span>
                    {/* Tombol hapus */}
                    <button onClick={() => removeFromCart(item.id)}
                      className="ml-1 p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100">
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Pajak (10%)</span><span>{formatRupiah(tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-amber-700">{formatRupiah(total)}</span>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-gray-400 mb-1 block">Metode Pembayaran</label>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${paymentMethod === "cash" ? "bg-amber-700 text-white border-amber-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                    💵 Cash
                  </button>
                  <button onClick={() => setPaymentMethod("qris")}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${paymentMethod === "qris" ? "bg-amber-700 text-white border-amber-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                    📱 QRIS
                  </button>
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div className="mb-3">
                  <label className="text-[10px] text-black mb-1 block">Uang diterima</label>
                  <input type="text" placeholder="Rp 0" value={paid}
                    onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); setPaid(raw ? "Rp " + parseInt(raw).toLocaleString("id-ID") : ""); }}
                    className="w-full px-3 py-2 text-sm border text-black border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors" />
                  {paidNum > 0 && paidNum >= total && <p className="text-xs text-emerald-600 mt-1">Kembalian: {formatRupiah(kembalian)}</p>}
                  {paidNum > 0 && paidNum < total && <p className="text-xs text-red-500 mt-1">Kurang: {formatRupiah(total - paidNum)}</p>}
                </div>
              )}

              <button onClick={handleBayar}
                disabled={cart.length === 0 || (paymentMethod === "cash" && paidNum < total) || loading || qrisLoading}
                className="w-full py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {loading || qrisLoading ? "Memproses..." : paymentMethod === "qris" ? "Bayar via QRIS" : "Bayar Cash"}
              </button>
            </div>
          )}
        </aside>

        {/* Modal Sukses + Struk */}
        {success && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>

              {/* Struk */}
              <div ref={strutRef} className="px-6 py-5 border-b border-dashed border-gray-200">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-gray-900">KOPI NUSANTARA</p>
                  <p className="text-[10px] text-gray-400">{trxTime}</p>
                  <p className="text-[10px] text-gray-400">No: {trxId}</p>
                </div>
                <div className="space-y-1 mb-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-gray-700">
                      <span className="flex-1 truncate pr-2">{item.name} x{item.qty}</span>
                      <span className="flex-shrink-0">{formatRupiah(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Pajak (10%)</span><span>{formatRupiah(tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
                    <span>Total</span><span>{formatRupiah(total)}</span>
                  </div>
                  {paymentMethod === "cash" && (
                    <>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Bayar</span><span>{formatRupiah(paidNum)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-600 font-medium">
                        <span>Kembalian</span><span>{formatRupiah(kembalian)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Metode</span><span>{paymentMethod === "cash" ? "Cash" : "QRIS"}</span>
                  </div>
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-3">Terima kasih!</p>
              </div>

              {/* Tombol aksi */}
              <div className="px-6 py-4 space-y-2">
                <button onClick={printStruk}
                  className="w-full py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  🖨️ Cetak Struk
                </button>
                <button onClick={clearCart}
                  className="w-full py-2 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors">
                  Transaksi Berikutnya
                </button>
                <button onClick={() => router.push("/dashboard")}
                  className="w-full py-2 bg-white text-gray-500 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Kembali ke Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}