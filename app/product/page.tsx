"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  price: number;
  costPrice?: number;
  stock: number;
  minStock: number;
  unit: string;
  category?: string;
  imageUrl?: string;
  storeId: string;
  label?: string | null;
}

const emptyForm = {
  name: "", barcode: "", sku: "", price: "", costPrice: "",
  stock: "", minStock: "5", unit: "pcs", category: "", imageUrl: "", label: "",
};

function fmt(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

const unitOptions = ["pcs", "box", "lusin", "kg", "gram", "liter", "ml"];
const labelOptions = ["", "Best Seller", "Promo", "Baru"];
const labelStyle: Record<string, string> = {
  "Best Seller": "bg-amber-50 text-amber-700",
  "Promo":       "bg-purple-50 text-purple-700",
  "Baru":        "bg-blue-50 text-blue-700",
};

type SortKey = "name" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";
type StockFilter = "all" | "ok" | "low" | "empty";

export default function ProdukPage() {
  const { data: session } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter]     = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortKey, setSortKey]         = useState<SortKey>("name");

  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Product | null>(null);
  const [form, setForm]                 = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);

  // Inline edit
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: "stock" | "price" } | null>(null);
  const [inlineVal, setInlineVal]   = useState("");
  const inlineRef = useRef<HTMLInputElement>(null);

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkCat, setBulkCat]       = useState("");
  const [bulkPrice, setBulkPrice]   = useState("");

  // Barcode scan
  const [scanMode, setScanMode]         = useState(false);
  const [devices, setDevices]           = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Categories
  const [customCategories, setCustomCategories] = useState<string[]>(["Kopi","Non-Kopi","Makanan","Minuman"]);
  const [showAddCategory, setShowAddCategory]   = useState(false);
  const [newCategory, setNewCategory]           = useState("");

  // ── Fetch produk ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/products?storeId=${storeId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d); })
      .catch(() => showToast("Gagal memuat produk", "err"));
  }, [storeId]);

  // ── Fetch daftar kamera saat halaman load ─────────────────────
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const videoDevs = devs.filter(d => d.kind === "videoinput");
      setDevices(videoDevs);
      // Default pilih kamera terakhir (biasanya DroidCam/external)
      if (videoDevs.length > 0) {
        setSelectedDeviceId(videoDevs[videoDevs.length - 1].deviceId);
      }
    }).catch(() => {
      // Label kamera mungkin kosong sebelum izin diberikan — akan diisi ulang setelah startScan
    });
  }, []);

  // ── Cleanup kamera saat komponen unmount ──────────────────────
  useEffect(() => {
    return () => {
      const iv = intervalRef.current as any;
      if (iv?._zxing) {
        try { iv._zxing.reset(); } catch {}
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Derived categories from products + custom
  const allCategories = Array.from(new Set([
    ...customCategories,
    ...products.map(p => p.category).filter(Boolean) as string[],
  ]));

  // Low stock count
  const lowCount   = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const emptyCount = products.filter(p => p.stock === 0).length;

  // Filter + sort
  const filtered = products
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.includes(q);
      const matchCat    = catFilter === "all" || p.category === catFilter;
      const matchStock  =
        stockFilter === "all"   ? true :
        stockFilter === "empty" ? p.stock === 0 :
        stockFilter === "low"   ? p.stock > 0 && p.stock <= p.minStock :
                                  p.stock > p.minStock;
      return matchSearch && matchCat && matchStock;
    })
    .sort((a, b) => {
      if (sortKey === "name")       return a.name.localeCompare(b.name);
      if (sortKey === "price_asc")  return a.price - b.price;
      if (sortKey === "price_desc") return b.price - a.price;
      if (sortKey === "stock_asc")  return a.stock - b.stock;
      if (sortKey === "stock_desc") return b.stock - a.stock;
      return 0;
    });

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Inline edit ──────────────────────────────────────────────
  function startInline(id: string, field: "stock" | "price", curVal: number) {
    setInlineEdit({ id, field });
    setInlineVal(curVal.toString());
    setTimeout(() => inlineRef.current?.select(), 50);
  }

  async function commitInline() {
    if (!inlineEdit) return;
    const val = parseInt(inlineVal);
    if (isNaN(val) || val < 0) { setInlineEdit(null); return; }
    const product = products.find(p => p.id === inlineEdit.id);
    if (!product) { setInlineEdit(null); return; }
    const payload = inlineEdit.field === "stock"
      ? { ...product, stock: val }
      : { ...product, price: val };
    try {
      const res = await fetch(`/api/products/${inlineEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      showToast(`${inlineEdit.field === "stock" ? "Stok" : "Harga"} diperbarui`);
    } catch {
      showToast("Gagal update", "err");
    }
    setInlineEdit(null);
  }

  // ── Bulk actions ─────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  }

  async function runBulkDelete() {
    for (const id of selected) {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
    }
    setProducts(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    showToast(`${selected.size} produk dihapus`);
  }

  async function runBulkCategory() {
    if (!bulkCat) return;
    for (const id of selected) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, category: bulkCat }),
      });
    }
    setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, category: bulkCat } : p));
    setSelected(new Set());
    setBulkCat("");
    showToast("Kategori diperbarui");
  }

  async function runBulkPrice() {
    const val = parseInt(bulkPrice);
    if (isNaN(val) || val <= 0) return;
    for (const id of selected) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, price: val }),
      });
    }
    setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, price: val } : p));
    setSelected(new Set());
    setBulkPrice("");
    showToast("Harga diperbarui");
  }

  // ── Barcode scan ─────────────────────────────────────────────
  function stopScan() {
    const iv = intervalRef.current as any;
    if (iv?._zxing) {
      try { iv._zxing.reset(); } catch {}
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanMode(false);
  }

  // 🔥 FIX: hapus blok try/catch duplikat dan deklarasi stream ganda
  async function startScan() {
    setScanMode(true);

    let stream: MediaStream;
    try {
      const videoConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : { facingMode: "environment" };

      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    } catch {
      showToast("Gagal akses kamera", "err");
      setScanMode(false);
      return;
    }

    // Refresh daftar kamera setelah izin diberikan (label baru tersedia)
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const videoDevs = devs.filter(d => d.kind === "videoinput");
      setDevices(videoDevs);
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;

      // Tunggu video benar-benar siap dulu baru mulai detect
      await new Promise<void>(resolve => {
        videoRef.current!.onloadedmetadata = () => {
          videoRef.current!.play().then(resolve).catch(resolve);
        };
      });
    }

    const BD = (window as any).BarcodeDetector;

    if (BD) {
      const supported = await BD.getSupportedFormats();
      console.log("Format didukung browser:", supported);

      const detector = new BD({ formats: supported });

      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const barcodeVal = codes[0].rawValue;
            console.log("Berhasil scan:", barcodeVal);
            stopScan();
            handleBarcodeResult(barcodeVal);
          }
        } catch (err) {
          console.log("Error detect:", err);
        }
      }, 200);

    } else {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const codeReader = new BrowserMultiFormatReader();
        intervalRef.current = { _zxing: codeReader } as any;
        const result = await codeReader.decodeFromVideoElement(videoRef.current!);
        if (result) {
          stopScan();
          handleBarcodeResult(result.getText());
        }
      } catch {
        showToast("Browser tidak support scan barcode", "err");
        stopScan();
      }
    }
  }

  // Restart scan saat device dipilih ulang saat scan sedang aktif
  async function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    if (scanMode) {
      stopScan();
      setTimeout(() => startScan(), 300);
    }
  }

  function handleBarcodeResult(barcodeVal: string) {
    const found = products.find(p => p.barcode === barcodeVal);
    if (found) {
      openEdit(found);
    } else {
      setForm(f => ({ ...f, barcode: barcodeVal }));
      setEditTarget(null);
      setShowModal(true);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null); setForm(emptyForm);
    setShowAddCategory(false); setNewCategory("");
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditTarget(product);
    setForm({
      name: product.name, barcode: product.barcode ?? "", sku: product.sku ?? "",
      price: product.price.toString(), costPrice: product.costPrice?.toString() ?? "",
      stock: product.stock.toString(), minStock: product.minStock.toString(),
      unit: product.unit, category: product.category ?? "",
      imageUrl: product.imageUrl ?? "", label: product.label ?? "",
    });
    if (product.category && !customCategories.includes(product.category))
      setCustomCategories(prev => [...prev, product.category!]);
    setShowAddCategory(false); setNewCategory("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false); setEditTarget(null); setForm(emptyForm);
    setShowAddCategory(false); setNewCategory("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("Maks 2MB", "err"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(fileName);
      setForm(f => ({ ...f, imageUrl: data.publicUrl }));
      showToast("Gambar berhasil diupload");
    } catch { showToast("Upload gagal", "err"); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price || !form.stock) return;
    setLoading(true);
    const payload = {
      name: form.name.trim(), barcode: form.barcode.trim() || null,
      sku: form.sku.trim() || null, price: parseInt(form.price),
      costPrice: form.costPrice ? parseInt(form.costPrice) : null,
      stock: parseInt(form.stock), minStock: parseInt(form.minStock) || 5,
      unit: form.unit || "pcs", category: form.category.trim() || null,
      imageUrl: form.imageUrl || null, label: form.label || null, storeId,
    };
    try {
      if (editTarget) {
        const res = await fetch(`/api/products/${editTarget.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast("Produk diperbarui");
      } else {
        const res = await fetch("/api/products", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const np = await res.json();
        setProducts(prev => [np, ...prev]);
        showToast("Produk ditambahkan");
      }
    } catch { showToast("Gagal menyimpan", "err"); }
    finally { setLoading(false); closeModal(); }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast("Produk dihapus");
    } catch { showToast("Gagal menghapus", "err"); }
    finally { setDeleteConfirm(null); }
  }

  function saveNewCategory() {
    const t = newCategory.trim();
    if (!t) return;
    if (!customCategories.includes(t)) setCustomCategories(prev => [...prev, t]);
    setForm(f => ({ ...f, category: t }));
    setNewCategory(""); setShowAddCategory(false);
  }

  const profit = form.price && form.costPrice
    ? parseInt(form.price) - parseInt(form.costPrice) : null;

  function marginColor(price: number, cost?: number) {
    if (!cost) return "";
    const pct = ((price - cost) / price) * 100;
    if (pct < 0)  return "text-red-500";
    if (pct < 20) return "text-orange-500";
    return "text-emerald-600";
  }
  function marginLabel(price: number, cost?: number) {
    if (!cost) return "—";
    return Math.round(((price - cost) / price) * 100) + "%";
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">Produk</span>
          {(lowCount > 0 || emptyCount > 0) && (
            <div className="flex items-center gap-1.5">
              {lowCount > 0 && (
                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                  ⚠ {lowCount} menipis
                </span>
              )}
              {emptyCount > 0 && (
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                  ✕ {emptyCount} habis
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={scanMode ? stopScan : startScan}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              scanMode ? "bg-red-50 border-red-200 text-red-600" : "border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
              <rect x="2" y="5" width="12" height="7" rx="1" stroke="currentColor"/>
              <path d="M6 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeLinecap="round"/>
              <path d="M5 9h6" stroke="currentColor" strokeLinecap="round"/>
            </svg>
            {scanMode ? "Stop Scan" : "Scan Barcode"}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={2}>
              <path d="M8 3v10M3 8h10" stroke="white" strokeLinecap="round"/>
            </svg>
            Tambah Produk
          </button>
        </div>
      </header>

      {/* ── SCAN VIEW ── */}
      {scanMode && (
        <div className="bg-black flex items-center justify-center py-3 flex-shrink-0">
          <div className="flex flex-col items-center gap-2">

            {/* Dropdown pilih kamera */}
            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                className="w-64 px-2 py-1.5 text-xs rounded-lg bg-gray-800 text-white border border-gray-600 outline-none"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Kamera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-64 h-40 object-cover rounded-lg" />
              {/* Crosshair overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-20 border-2 border-amber-400 rounded-md relative">
                  <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-amber-300 rounded-tl" />
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-amber-300 rounded-tr" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-amber-300 rounded-bl" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-amber-300 rounded-br" />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">Arahkan barcode ke dalam kotak kuning</p>
          </div>
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeLinecap="round"/>
          </svg>
          <input
            type="text" placeholder="Cari nama, SKU, barcode..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm text-black bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 w-52"
          />
        </div>

        {/* Category filter */}
        <select
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-1.5 text-xs text-black border border-gray-200 rounded-lg outline-none focus:border-amber-300 bg-white"
        >
          <option value="all">Semua Kategori</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Stock filter */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {([
            ["all", "Semua"], ["ok", "Aman"], ["low", "Menipis"], ["empty", "Habis"],
          ] as [StockFilter, string][]).map(([key, label]) => (
            <button
              key={key} onClick={() => setStockFilter(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                stockFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="px-3 py-1.5 text-xs text-black border border-gray-200 rounded-lg outline-none focus:border-amber-300 bg-white ml-auto"
        >
          <option value="name">Nama A–Z</option>
          <option value="price_asc">Harga Murah dulu</option>
          <option value="price_desc">Harga Mahal dulu</option>
          <option value="stock_asc">Stok Sedikit dulu</option>
          <option value="stock_desc">Stok Banyak dulu</option>
        </select>

        <span className="text-xs text-gray-400">{filtered.length} produk</span>
      </div>

      {/* ── BULK ACTION BAR ── */}
      {selected.size > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-xs font-medium text-amber-800">{selected.size} dipilih</span>

          <button
            onClick={runBulkDelete}
            className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >Hapus</button>

          <div className="flex items-center gap-1.5">
            <select
              value={bulkCat} onChange={e => setBulkCat(e.target.value)}
              className="px-2 py-1.5 text-xs text-black border border-amber-200 rounded-lg bg-white outline-none"
            >
              <option value="">Pindah kategori...</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={runBulkCategory} disabled={!bulkCat}
              className="px-3 py-1.5 text-xs bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-40 transition-colors"
            >Terapkan</button>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number" placeholder="Harga baru..."
              value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
              className="px-2 py-1.5 text-xs text-black border border-amber-200 rounded-lg w-32 outline-none"
            />
            <button
              onClick={runBulkPrice} disabled={!bulkPrice}
              className="px-3 py-1.5 text-xs bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-40 transition-colors"
            >Update Harga</button>
          </div>

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700"
          >Batal pilih</button>
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {["PRODUK","SKU","HARGA","MARGIN","STOK","STATUS",""].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                    {products.length === 0 ? "Belum ada produk. Tambah produk pertama kamu!" : "Produk tidak ditemukan."}
                  </td>
                </tr>
              ) : filtered.map(p => {
                const isLow   = p.stock > 0 && p.stock <= p.minStock;
                const isEmpty = p.stock === 0;
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selected.has(p.id) ? "bg-amber-50/50" : ""}`}>

                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                    </td>

                    {/* Produk */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover"/>
                            : <span className="text-base">🛍️</span>
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800">{p.name}</p>
                            {p.label && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${labelStyle[p.label] ?? "bg-gray-100 text-gray-600"}`}>
                                {p.label}
                              </span>
                            )}
                          </div>
                          {p.category && (
                            <p className="text-[10px] text-gray-400">{p.category} · {p.unit}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3 text-xs text-gray-400">{p.sku ?? "—"}</td>

                    {/* Harga — inline edit */}
                    <td className="px-4 py-3">
                      {inlineEdit?.id === p.id && inlineEdit.field === "price" ? (
                        <input
                          ref={inlineRef} type="number" value={inlineVal}
                          onChange={e => setInlineVal(e.target.value)}
                          onBlur={commitInline}
                          onKeyDown={e => { if (e.key === "Enter") commitInline(); if (e.key === "Escape") setInlineEdit(null); }}
                          className="w-24 px-2 py-1 text-sm text-black border border-amber-400 rounded outline-none"
                        />
                      ) : (
                        <div
                          onClick={() => startInline(p.id, "price", p.price)}
                          className="cursor-text group"
                          title="Klik untuk edit harga"
                        >
                          <p className="text-sm text-gray-700 group-hover:text-amber-700 transition-colors">{fmt(p.price)}</p>
                          {p.costPrice && <p className="text-[10px] text-gray-400">Modal: {fmt(p.costPrice)}</p>}
                        </div>
                      )}
                    </td>

                    {/* Margin */}
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className={marginColor(p.price, p.costPrice)}>
                        {marginLabel(p.price, p.costPrice)}
                      </span>
                    </td>

                    {/* Stok — inline edit */}
                    <td className="px-4 py-3">
                      {inlineEdit?.id === p.id && inlineEdit.field === "stock" ? (
                        <input
                          ref={inlineRef} type="number" value={inlineVal}
                          onChange={e => setInlineVal(e.target.value)}
                          onBlur={commitInline}
                          onKeyDown={e => { if (e.key === "Enter") commitInline(); if (e.key === "Escape") setInlineEdit(null); }}
                          className="w-20 px-2 py-1 text-sm text-black border border-amber-400 rounded outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => startInline(p.id, "stock", p.stock)}
                          className={`text-sm cursor-text hover:text-amber-700 transition-colors ${isEmpty ? "text-red-500" : isLow ? "text-orange-500" : "text-gray-700"}`}
                          title="Klik untuk edit stok"
                        >
                          {p.stock} {p.unit}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isEmpty ? "bg-red-50 text-red-600"
                        : isLow  ? "bg-orange-50 text-orange-600"
                        : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {isEmpty ? "Habis" : isLow ? "Menipis" : "Aman"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                            <path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirm(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                            <path d="M3 4h10M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL TAMBAH/EDIT ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-gray-900">{editTarget ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Wajib */}
              <div className="pb-3 border-b border-gray-100">
                <p className="text-[10px] font-medium text-gray-400 tracking-wider mb-3">WAJIB DIISI</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nama Produk <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="Contoh: Aqua 600ml" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Harga Jual (Rp) <span className="text-red-400">*</span></label>
                      <input type="number" placeholder="7000" value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Stok <span className="text-red-400">*</span></label>
                      <input type="number" placeholder="100" value={form.stock}
                        onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Opsional */}
              <div>
                <p className="text-[10px] font-medium text-gray-400 tracking-wider mb-3">OPSIONAL</p>
                <div className="space-y-3">

                  {/* Upload */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Foto Produk</label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {form.imageUrl
                          ? <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover"/>
                          : <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300" fill="none" strokeWidth={1.5}>
                              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
                              <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeLinecap="round"/>
                            </svg>
                        }
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer">
                          <div className={`px-3 py-2 text-xs border border-dashed border-gray-300 rounded-lg text-center text-gray-500 transition-colors ${uploading ? "opacity-50" : "hover:border-amber-400 hover:text-amber-700"}`}>
                            {uploading ? "Mengupload..." : form.imageUrl ? "Ganti Gambar" : "Upload Gambar"}
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading}/>
                        </label>
                        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, WEBP. Maks 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Barcode</label>
                      <input type="text" placeholder="8999999012345" value={form.barcode}
                        onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                      <input type="text" placeholder="MNM-001" value={form.sku}
                        onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Harga Modal (Rp)</label>
                      <input type="number" placeholder="5000" value={form.costPrice}
                        onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                      {profit !== null && (
                        <p className="text-[10px] text-emerald-600 mt-1">Untung: {fmt(profit)} / item</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Min. Stok Alert</label>
                      <input type="number" placeholder="5" value={form.minStock}
                        onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Satuan</label>
                      <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 bg-white"
                      >
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Label</label>
                      <select value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 bg-white"
                      >
                        {labelOptions.map(l => <option key={l} value={l}>{l || "— Tanpa Label —"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Kategori</label>
                      <div className="flex gap-1">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className="flex-1 px-2 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 bg-white"
                        >
                          <option value="">—</option>
                          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowAddCategory(v => !v)}
                          className="px-2 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50"
                        >+</button>
                      </div>
                      {showAddCategory && (
                        <div className="flex gap-1 mt-1.5">
                          <input type="text" placeholder="Kategori baru..." value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveNewCategory(); }}
                            className="flex-1 px-2 py-1.5 text-xs text-black border border-amber-300 rounded-lg outline-none"
                            autoFocus
                          />
                          <button type="button" onClick={saveNewCategory}
                            className="px-2 py-1.5 text-xs bg-amber-700 text-white rounded-lg"
                          >OK</button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={closeModal}
                className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
              >Batal</button>
              <button onClick={handleSave}
                disabled={!form.name.trim() || !form.price || !form.stock || loading || uploading}
                className="flex-1 py-2 text-sm text-white bg-amber-700 rounded-xl hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Menyimpan..." : editTarget ? "Simpan Perubahan" : "Tambah Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HAPUS ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 w-80 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500" fill="none" strokeWidth={1.5}>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">Hapus produk ini?</p>
            <p className="text-xs text-gray-400 mb-5">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2 text-sm text-white bg-red-500 rounded-xl hover:bg-red-600">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-xs px-4 py-2.5 rounded-full z-50 ${toast.type === "err" ? "bg-red-500" : "bg-gray-900"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}