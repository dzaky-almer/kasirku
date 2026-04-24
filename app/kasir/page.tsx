"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { useDemoMode } from "@/lib/demo";

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
  note?: string;
}

interface HeldCart {
  id: string;
  label: string;
  labelType: "customer" | "table" | "custom";
  customerName?: string;
  tableNumber?: string;
  createdAt: string;
  cart: CartItem[];
  selectedPromoId: string | null;
}

// ── TIPE PROMO (updated: multi-rule) ────────────────────────
interface PromoRule {
  id: string;
  type: "PRODUCT" | "HAPPY_HOUR" | "MIN_TRANSACTION";
  discountType: "PERCENT" | "NOMINAL";
  discountValue: number;
  productId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  minTransaction?: number | null;
}

interface Promo {
  id: string;
  name: string;
  tag?: string | null;
  isActive: boolean;
  rules: PromoRule[];
}

interface SessionUser {
  id?: string;
  name?: string;
  storeId?: string;
}

interface ShiftInfo {
  id: string;
}

interface TransactionRecord {
  id: string;
}

interface MidtransSnapCallbacks {
  onSuccess: () => void | Promise<void>;
  onPending: () => void;
  onError: () => void;
  onClose: () => void;
}

interface MidtransSnap {
  pay: (token: string, callbacks: MidtransSnapCallbacks) => void;
}

function formatRupiah(amount: number): string {
  if (amount == null || isNaN(amount)) return "Rp 0";
  return "Rp " + amount.toLocaleString("id-ID");
}

declare global {
  interface Window {
    snap?: MidtransSnap;
  }
}

// ── HELPER: validasi & hitung diskon (multi-rule) ────────────
function calcDiscount(
  promo: Promo,
  cart: CartItem[],
  subtotal: number
): { amount: number; valid: boolean; reason?: string } {
  if (!promo.rules?.length) {
    return { amount: 0, valid: false, reason: "Tidak ada aturan promo" };
  }

  let totalDiscount = 0;
  let anyValid = false;
  let lastReason: string | undefined;

  for (const rule of promo.rules) {
    // Validasi HAPPY_HOUR
    if (rule.type === "HAPPY_HOUR") {
      if (!rule.startTime || !rule.endTime) {
        lastReason = "Konfigurasi happy hour tidak lengkap";
        continue;
      }
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = rule.startTime.split(":").map(Number);
      const [eh, em] = rule.endTime.split(":").map(Number);
      if (cur < sh * 60 + sm || cur > eh * 60 + em) {
        lastReason = `Berlaku ${rule.startTime}–${rule.endTime}`;
        continue;
      }
    }

    // Validasi MIN_TRANSACTION
    if (rule.type === "MIN_TRANSACTION") {
      if (!rule.minTransaction || subtotal < rule.minTransaction) {
        lastReason = `Min. transaksi ${formatRupiah(rule.minTransaction ?? 0)}`;
        continue;
      }
    }

    // Hitung base
    let base = subtotal;
    if (rule.type === "PRODUCT" && rule.productId) {
      const target = cart.filter((i) => i.id === rule.productId);
      if (!target.length) {
        lastReason = "Produk promo tidak ada di keranjang";
        continue;
      }
      base = target.reduce((s, i) => s + i.price * i.qty, 0);
    }

    const amount =
      rule.discountType === "PERCENT"
        ? Math.round((base * rule.discountValue) / 100)
        : rule.discountValue;

    totalDiscount += amount;
    anyValid = true;
  }

  if (!anyValid) return { amount: 0, valid: false, reason: lastReason };
  return { amount: Math.min(totalDiscount, subtotal), valid: true };
}

// ── Helper label tipe promo ───────────────────────────────
function promoTypeLabel(promo: Promo): string {
  if (!promo.rules?.length) return "Semua produk";
  return promo.rules
    .map((rule) => {
      if (rule.type === "HAPPY_HOUR") return `Happy hour ${rule.startTime}–${rule.endTime}`;
      if (rule.type === "MIN_TRANSACTION") return `Min. ${formatRupiah(rule.minTransaction ?? 0)}`;
      if (rule.type === "PRODUCT") return "Diskon produk tertentu";
      return "Semua produk";
    })
    .join(" + ");
}

// ── Helper label diskon promo ─────────────────────────────
function promoDiscLabel(promo: Promo): string {
  if (!promo.rules?.length) return "-";
  return promo.rules
    .map((rule) =>
      rule.discountType === "PERCENT"
        ? `${rule.discountValue}%`
        : formatRupiah(rule.discountValue)
    )
    .join(" + ");
}

export default function KasirPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { demoStoreId, demoUserId, isDemoMode } = useDemoMode();
  const sessionUser = (session?.user ?? {}) as SessionUser;
  const storeId = isDemoMode ? demoStoreId : sessionUser.storeId ?? "";
  const userId = isDemoMode ? demoUserId : sessionUser.id ?? "";
  const pushWithMode = (href: string) => router.push(isDemoMode ? `${href}?demo=true` : href);
  const strutRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const categories = useMemo(
    () => [
      "Semua",
      ...Array.from(
        new Set(products.map((p) => p.category).filter(Boolean) as string[])
      ),
    ],
    [products]
  );

  const [activeCategory, setActiveCategory] = useState("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paid, setPaid] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [qrisLoading, setQrisLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<TransactionRecord | null>(null);
  const [shift, setShift] = useState<ShiftInfo | null>(null);

  // ── STATE PROMO ──────────────────────────────────────────
  const [promos, setPromos] = useState<Promo[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdLabelType, setHoldLabelType] = useState<"customer" | "table" | "custom">("customer");
  const [holdCustomerName, setHoldCustomerName] = useState("");
  const [holdTableNumber, setHoldTableNumber] = useState("");
  const [holdCustomLabel, setHoldCustomLabel] = useState("");
  const [heldCartSearch, setHeldCartSearch] = useState("");

  const heldCartStorageKey = storeId ? `kasirku_held_carts_${storeId}` : "";

  useEffect(() => {
    if (!storeId) {
      setProducts([]);
      return;
    }

    setProducts([]);
    fetch(`/api/products?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data))
          setProducts(data.map((p) => ({ ...p, price: p.price ?? 0 })));
      })
      .catch(() => console.error("Gagal fetch produk"));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setShift(null);
      return;
    }

    setShift(null);
    fetch(`/api/shifts/current?storeId=${encodeURIComponent(storeId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error();
        setShift(data);
      })
      .catch(() => setShift(null));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setPromos([]);
      return;
    }

    setPromos([]);
    fetch(`/api/promos?storeId=${storeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPromos(data);
      })
      .catch(() => { });
  }, [storeId]);

  useEffect(() => {
    setCart([]);
    setSelectedPromo(null);
    setShowPromoPanel(false);
    setLastTransaction(null);
    setSuccess(false);
    setPaid("");
  }, [storeId]);

  useEffect(() => {
    if (!heldCartStorageKey || typeof window === "undefined") {
      setHeldCarts([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(heldCartStorageKey);
      if (!raw) {
        setHeldCarts([]);
        return;
      }

      const parsed = JSON.parse(raw);
      setHeldCarts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHeldCarts([]);
    }
  }, [heldCartStorageKey]);

  useEffect(() => {
    if (!heldCartStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(heldCartStorageKey, JSON.stringify(heldCarts));
  }, [heldCarts, heldCartStorageKey]);

  // ── KALKULASI ────────────────────────────────────────────
  const subtotal = cart.reduce((sum, c) => sum + (c.price ?? 0) * c.qty, 0);
  const tax = Math.round(subtotal * 0.1);

  const promoResult = useMemo(() => {
    if (!selectedPromo) return { amount: 0, valid: false };
    return calcDiscount(selectedPromo, cart, subtotal + tax);
  }, [selectedPromo, cart, subtotal, tax]);

  const discount = promoResult.valid ? promoResult.amount : 0;
  const total = Math.max(0, subtotal + tax - discount);
  const paidNum = parseInt(paid.replace(/\D/g, "")) || 0;
  const kembalian = paidNum - total;

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "Semua" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing)
        return prev.map((c) =>
          c.id === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      return [...prev, { ...product, price: product.price ?? 0, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  function setQtyDirect(id: string, val: string) {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    if (num === 0) setCart((prev) => prev.filter((c) => c.id !== id));
    else setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: num } : c)));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function setItemNote(id: string, note: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, note: note.trim() ? note : "" }
          : item
      )
    );
  }

  function resetCheckoutState() {
    setPaid("");
    setSuccess(false);
    setPaymentMethod("cash");
    setSelectedPromo(null);
    setShowPromoPanel(false);
  }

  function clearCart() {
    setCart([]);
    resetCheckoutState();
  }

  function openHoldModal() {
    if (cart.length === 0) return;
    setHoldLabelType("customer");
    setHoldCustomerName("");
    setHoldTableNumber("");
    setHoldCustomLabel("");
    setShowHoldModal(true);
  }

  function holdCurrentCart() {
    if (cart.length === 0) return;

    const fallbackLabel = `Draft ${new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const customerName = holdCustomerName.trim();
    const tableNumber = holdTableNumber.trim();
    const customLabel = holdCustomLabel.trim();

    const label =
      holdLabelType === "customer"
        ? customerName || fallbackLabel
        : holdLabelType === "table"
          ? (tableNumber ? `Meja ${tableNumber}` : fallbackLabel)
          : customLabel || fallbackLabel;

    const nextHeldCart: HeldCart = {
      id: `${Date.now()}`,
      label,
      labelType: holdLabelType,
      customerName: customerName || undefined,
      tableNumber: tableNumber || undefined,
      createdAt: new Date().toISOString(),
      cart,
      selectedPromoId: selectedPromo?.id ?? null,
    };

    setHeldCarts((prev) => [nextHeldCart, ...prev].slice(0, 10));
    setCart([]);
    resetCheckoutState();
    setShowHoldModal(false);
  }

  function restoreHeldCart(heldCart: HeldCart) {
    setCart(heldCart.cart);
    setSelectedPromo(
      heldCart.selectedPromoId
        ? promos.find((promo) => promo.id === heldCart.selectedPromoId) ?? null
        : null
    );
    setHeldCarts((prev) => prev.filter((entry) => entry.id !== heldCart.id));
    setPaid("");
    setSuccess(false);
    setPaymentMethod("cash");
    setShowPromoPanel(false);
  }

  function removeHeldCart(id: string) {
    setHeldCarts((prev) => prev.filter((entry) => entry.id !== id));
  }

  const visibleHeldCarts = heldCarts.filter((heldCart) => {
    const query = heldCartSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      heldCart.label,
      heldCart.customerName,
      heldCart.tableNumber,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  // ── STRUK ────────────────────────────────────────────────
  function printStruk() {
    const now = new Date();
    const trxTime = now.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const itemRows = cart
      .map(
        (item) =>
          `<tr>
        <td style="padding:1px 0">${item.name}</td>
        <td style="text-align:right;white-space:nowrap">${item.qty} x ${formatRupiah(item.price)}</td>
      </tr>
      ${item.note?.trim()
            ? `<tr><td colspan="2" style="padding:0 0 3px 0;color:#666;font-size:11px">Catatan: ${item.note}</td></tr>`
            : ""}
      <tr>
        <td colspan="2" style="text-align:right;padding-bottom:3px">${formatRupiah(item.price * item.qty)}</td>
      </tr>`
      )
      .join("");

    const discountRow =
      discount > 0 && selectedPromo
        ? `<tr><td>Diskon (${selectedPromo.name})</td><td style="text-align:right">-${formatRupiah(discount)}</td></tr>`
        : "";

    const cashRows =
      paymentMethod === "cash"
        ? `<tr><td>Tunai</td><td style="text-align:right">${formatRupiah(paidNum)}</td></tr>
           <tr><td>Kembali</td><td style="text-align:right">${formatRupiah(kembalian)}</td></tr>`
        : `<tr><td colspan="2" style="text-align:center">-- Dibayar via QRIS --</td></tr>`;

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
    <tr><td>Kasir</td><td style="text-align:right">${isDemoMode ? "Kasir Demo" : sessionUser.name ?? "Kasir"}</td></tr>
  </table>
  <div class="divider-dash"></div>
  <table>${itemRows}</table>
  <div class="divider-dash"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(subtotal)}</td></tr>
    <tr><td>PPN 10%</td><td style="text-align:right">${formatRupiah(tax)}</td></tr>
    ${discountRow}
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
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  }

  // ── CEK STOK ─────────────────────────────────────────────
  async function checkStock(): Promise<boolean> {
    const res = await fetch("/api/transactions/check-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        items: cart.map((item) => ({ productId: item.id, qty: item.qty })),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error || "Stok tidak cukup / produk habis");
      return false;
    }
    return true;
  }

  // ── SAVE TRANSACTION ─────────────────────────────────────
  async function saveTransaction(method: "cash" | "qris") {
    if (!shift?.id) {
      alert("Shift belum dibuka!");
      return false;
    }

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        userId,
        shiftId: shift.id,
        paymentMethod: method,
        items: cart.map((item) => ({
          productId: item.id,
          qty: item.qty,
          price: item.price,
          note: item.note?.trim() || undefined,
        })),
        promoId: promoResult.valid && selectedPromo ? selectedPromo.id : null,
        discountAmount: discount,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error || "Stok tidak cukup / produk habis");
      return false;
    }

    setLastTransaction(data);
    return true;
  }

  async function handleBayar() {
    if (cart.length === 0 || !storeId || !userId) return;

    // ── CASH ────────────────────────────────────────────────
    if (paymentMethod === "cash") {
      if (paidNum < total) return;
      setLoading(true);
      const ok = await saveTransaction("cash");
      if (!ok) { setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => printStruk(), 400);
      setLoading(false);
      return;
    }

    // ── QRIS ─────────────────────────────────────────────────
    setQrisLoading(true);
    try {
      const stockOk = await checkStock();
      if (!stockOk) { setQrisLoading(false); return; }

      const orderId = `TRX-${Date.now()}`;
      const res = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate QRIS");

      if (!window.snap) {
        alert("Midtrans belum siap");
        setQrisLoading(false);
        return;
      }

      window.snap.pay(data.token, {
        onSuccess: async () => {
          const ok = await saveTransaction("qris");
          if (!ok) { setQrisLoading(false); return; }
          setSuccess(true);
          setTimeout(() => printStruk(), 400);
          setQrisLoading(false);
        },
        onPending: () => { alert("Pembayaran pending."); setQrisLoading(false); },
        onError: () => { alert("Pembayaran gagal. Coba lagi."); setQrisLoading(false); },
        onClose: () => { setQrisLoading(false); },
      });
    } catch (err) {
      console.error(err);
      alert("Gagal generate QRIS. Coba lagi.");
      setQrisLoading(false);
    }
  }

  const now = new Date();
  const trxId = lastTransaction?.id?.slice(0, 8) ?? "—";
  const trxTime = now.toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Midtrans SNAP READY");
        }}
      />

      <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
        {/* ── PRODUCT AREA ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-gray-900">Kasir</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {now.toLocaleDateString("id-ID", {
                  weekday: "long", day: "numeric",
                  month: "short", year: "numeric",
                })}
              </span>
              <button
                onClick={() => pushWithMode("/dashboard")}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                ← Dashboard
              </button>
            </div>
          </header>

          {/* Search + Kategori */}
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0 ">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 " viewBox="0 0 16 16" fill="none" strokeWidth={1.5}>
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Cari menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm text-black bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 transition-colors shadow-[0_0_10px_rgba(0,0,0,0.20)]"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat
                    ? "bg-amber-700 text-white hover:bg-amber-800 shadow-[0_2px_5px_rgba(255,167,38,0.4)] hover:shadow-[0_4px_15px_rgba(255,167,38,0.4)]"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
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
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                      className={`bg-white shadow-[0_0_5px_rgba(0,0,0,0.15)] hover:shadow-amber-100 border rounded-xl overflow-hidden text-left hover:border-amber-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${inCart ? "border-amber-400" : "border-gray-100"
                        }`}
                    >
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
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                              {inCart.qty} di keranjang
                            </span>
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

        {/* ── CART SIDEBAR ─────────────────────────────────── */}
        <aside className="w-80 bg-white border-l border-gray-300 flex flex-col flex-shrink-0">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">Pesanan</span>
            <div className="flex items-center gap-3">
              {heldCarts.length > 0 && (
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {heldCarts.length} draft
                </span>
              )}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Kosongkan
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {heldCarts.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium text-gray-400 tracking-wider">DRAFT PESANAN</p>
                  <p className="text-[10px] text-gray-300">maks 10</p>
                </div>
                <div className="mb-2">
                  <input
                    type="text"
                    value={heldCartSearch}
                    onChange={(e) => setHeldCartSearch(e.target.value)}
                    placeholder="Cari draft, pelanggan, atau meja..."
                    className="w-full px-3 py-2 text-[11px] text-gray-700 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  {visibleHeldCarts.map((heldCart) => {
                    const itemCount = heldCart.cart.reduce((sum, item) => sum + item.qty, 0);
                    const heldTotal = heldCart.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

                    return (
                      <div key={heldCart.id} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-blue-900 truncate">{heldCart.label}</p>
                            <p className="text-[10px] text-blue-700 mt-0.5">
                              {itemCount} item · {formatRupiah(heldTotal)}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] bg-white/80 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                {heldCart.labelType === "customer"
                                  ? "Pelanggan"
                                  : heldCart.labelType === "table"
                                    ? "Meja"
                                    : "Label"}
                              </span>
                              {heldCart.customerName && (
                                <span className="text-[9px] text-blue-500">Nama: {heldCart.customerName}</span>
                              )}
                              {heldCart.tableNumber && (
                                <span className="text-[9px] text-blue-500">Meja {heldCart.tableNumber}</span>
                              )}
                            </div>
                            <p className="text-[10px] text-blue-400 mt-0.5">
                              {new Date(heldCart.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <button
                            onClick={() => removeHeldCart(heldCart.id)}
                            className="text-[10px] text-blue-400 hover:text-red-500 transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                        <button
                          onClick={() => restoreHeldCart(heldCart)}
                          className="w-full mt-2 py-2 rounded-lg bg-white border border-blue-200 text-xs font-medium text-blue-800 hover:bg-blue-100 transition-colors"
                        >
                          Panggil Draft
                        </button>
                      </div>
                    );
                  })}
                  {visibleHeldCarts.length === 0 && (
                    <p className="text-[11px] text-center text-gray-400 py-3">Draft tidak ditemukan.</p>
                  )}
                </div>
              </div>
            )}

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
                      <input
                        type="text"
                        value={item.note ?? ""}
                        onChange={(e) => setItemNote(item.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Tambah catatan item..."
                        className="mt-1 w-full px-2 py-1 text-[10px] text-gray-700 border border-gray-200 rounded-md outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-400 text-sm font-medium transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => setQtyDirect(item.id, e.target.value)}
                        className="w-8 h-6 text-center text-xs font-medium text-gray-800 border border-gray-400 rounded outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-amber-400 flex items-center justify-center text-black hover:bg-amber-500 text-sm font-medium transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-medium text-gray-700 min-w-[50px] text-right">
                      {formatRupiah(item.price * item.qty)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="ml-1 p-1 rounded text-red-200 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
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
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Pajak (10%)</span>
                  <span>{formatRupiah(tax)}</span>
                </div>

                {/* ── PROMO SECTION ──────────────────────── */}
                <div className="pt-2 border-t border-gray-700">
                  <button
                    onClick={() => setShowPromoPanel((v) => !v)}
                    className="w-full flex items-center justify-between py-1.5 text-xs text-gray-500 hover:text-amber-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                        <path d="M2 8h12M8 2v12" stroke="currentColor" strokeLinecap="round" />
                      </svg>
                      {selectedPromo && promoResult.valid ? (
                        <span className="text-green-600 font-medium">{selectedPromo.name}</span>
                      ) : (
                        "Pakai promo"
                      )}
                    </span>
                    {selectedPromo && promoResult.valid && (
                      <span className="text-green-600 font-medium">-{formatRupiah(discount)}</span>
                    )}
                  </button>

                  {showPromoPanel && (
                    <div className="mt-2 space-y-1.5 bg-gray-50 rounded-xl p-2.5">
                      {promos.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-1">Tidak ada promo aktif</p>
                      ) : (
                        <>
                          <button
                            onClick={() => { setSelectedPromo(null); setShowPromoPanel(false); }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!selectedPromo
                              ? "bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 hover:shadow-[0_0_5px_rgba(255,167,38,0.3)]"
                              : "text-gray-500 hover:bg-white hover:shadow-[0_0_5px_rgba(255,167,38,0.3)]"
                              }`}
                          >
                            Tanpa promo
                          </button>

                          {promos.map((promo) => {
                            const preview = calcDiscount(promo, cart, subtotal + tax);
                            const discLabel = promoDiscLabel(promo);
                            const isSelected = selectedPromo?.id === promo.id;

                            return (
                              <button
                                key={promo.id}
                                onClick={() => { setSelectedPromo(promo); setShowPromoPanel(false); }}
                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${isSelected
                                  ? "bg-amber-50 border border-amber-200 hover:shadow-[0_0_5px_rgba(255,167,38,0.3)]"
                                  : "hover:bg-white border border-transparent hover:shadow-[0_0_15px_rgba(255,167,38,0.3)]"
                                  }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className={`font-medium ${isSelected ? "text-amber-700" : "text-gray-700"}`}>
                                      {promo.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{promoTypeLabel(promo)}</p>
                                  </div>
                                  <span
                                    className={`font-medium ml-2 flex-shrink-0 ${preview.valid ? "text-green-600" : "text-gray-400 line-through"
                                      }`}
                                  >
                                    -{discLabel}
                                  </span>
                                </div>
                                {!preview.valid && (
                                  <p className="text-[10px] text-red-400 mt-0.5">{preview.reason}</p>
                                )}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {selectedPromo && !promoResult.valid && (
                    <p className="text-[10px] text-red-400 mt-1">{promoResult.reason}</p>
                  )}
                </div>
                {/* ── END PROMO SECTION ──────────────────── */}

                <div className="flex justify-between text-sm font-medium text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-amber-700">{formatRupiah(total)}</span>
                </div>
              </div>

              {/* Metode Bayar */}
              <div className="mb-3">
                <label className="text-[10px] text-gray-400 mb-1 block">Metode Pembayaran</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${paymentMethod === "cash"
                      ? "bg-amber-700 text-white border-amber-700"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-30 hover:shadow-[0_0_5px_rgba(255,167,38,0.3)]"
                      }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod("qris")}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${paymentMethod === "qris"
                      ? "bg-amber-700 text-white border-amber-700"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    QRIS
                  </button>
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div className="mb-3">
                  <label className="text-[10px] text-black mb-1 block">Uang diterima</label>
                  <input
                    type="text"
                    placeholder="Rp 0"
                    value={paid}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setPaid(raw ? "Rp " + parseInt(raw).toLocaleString("id-ID") : "");
                    }}
                    className="w-full px-3 py-2 text-sm border text-black border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                  />
                  {paidNum > 0 && paidNum >= total && (
                    <p className="text-xs text-emerald-600 mt-1">Kembalian: {formatRupiah(kembalian)}</p>
                  )}
                  {paidNum > 0 && paidNum < total && (
                    <p className="text-xs text-red-500 mt-1">Kurang: {formatRupiah(total - paidNum)}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openHoldModal}
                  disabled={cart.length === 0}
                  className="py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Tahan
                </button>
                <button
                  onClick={handleBayar}
                  disabled={
                    cart.length === 0 ||
                    (paymentMethod === "cash" && paidNum < total) ||
                    loading ||
                    qrisLoading
                  }
                  className="py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading || qrisLoading
                    ? "Memproses..."
                    : paymentMethod === "qris"
                      ? "Bayar QRIS"
                      : "Bayar Cash"}
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── MODAL SUKSES + STRUK ────────────────────────── */}
        {success && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div
              className="bg-white rounded-2xl w-80 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div ref={strutRef} className="px-6 py-5 border-b border-dashed border-gray-200">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-gray-900">KOPI NUSANTARA</p>
                  <p className="text-[10px] text-gray-400">{trxTime}</p>
                  <p className="text-[10px] text-gray-400">No: {trxId}</p>
                </div>
                <div className="space-y-1 mb-3">
                  {cart.map((item) => (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-gray-700">
                        <span className="flex-1 truncate pr-2">{item.name} x{item.qty}</span>
                        <span className="flex-shrink-0">{formatRupiah(item.price * item.qty)}</span>
                      </div>
                      {item.note?.trim() && (
                        <p className="text-[10px] text-gray-400">Catatan: {item.note}</p>
                      )}
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
                  {discount > 0 && selectedPromo && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Diskon ({selectedPromo.name})</span>
                      <span>-{formatRupiah(discount)}</span>
                    </div>
                  )}
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
                    <span>Metode</span>
                    <span>{paymentMethod === "cash" ? "Cash" : "QRIS"}</span>
                  </div>
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-3">Terima kasih!</p>
              </div>

              <div className="px-6 py-4 space-y-2">
                <button
                  onClick={printStruk}
                  className="w-full py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  🖨️ Cetak Struk
                </button>
                <button
                  onClick={clearCart}
                  className="w-full py-2 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors"
                >
                  Transaksi Berikutnya
                </button>
                <button
                  onClick={() => pushWithMode("/dashboard")}
                  className="w-full py-2 bg-white text-gray-500 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {showHoldModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">Tahan Pesanan</p>
                <p className="text-[11px] text-gray-400 mt-1">Beri identitas draft agar mudah dipanggil kembali.</p>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "customer", label: "Pelanggan" },
                    { id: "table", label: "Meja" },
                    { id: "custom", label: "Label" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setHoldLabelType(option.id as "customer" | "table" | "custom")}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        holdLabelType === option.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {holdLabelType === "customer" && (
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Nama pelanggan</label>
                    <input
                      type="text"
                      value={holdCustomerName}
                      onChange={(e) => setHoldCustomerName(e.target.value)}
                      placeholder="Contoh: Andi"
                      className="w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                {holdLabelType === "table" && (
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Nomor / nama meja</label>
                    <input
                      type="text"
                      value={holdTableNumber}
                      onChange={(e) => setHoldTableNumber(e.target.value)}
                      placeholder="Contoh: 07 atau VIP A"
                      className="w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                {holdLabelType === "custom" && (
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Label bebas</label>
                    <input
                      type="text"
                      value={holdCustomLabel}
                      onChange={(e) => setHoldCustomLabel(e.target.value)}
                      placeholder="Contoh: Takeaway Sinta"
                      className="w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                  <p className="text-[11px] text-blue-700">
                    Draft akan menyimpan item, catatan item, dan promo yang sedang dipakai.
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setShowHoldModal(false)}
                  className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={holdCurrentCart}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Simpan Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
