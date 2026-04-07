"use client";

import { useState, useEffect } from "react";
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
}

const emptyForm = {
  name: "",
  barcode: "",
  sku: "",
  price: "",
  costPrice: "",
  stock: "",
  minStock: "5",
  unit: "pcs",
  category: "",
  imageUrl: "",
};

function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

const unitOptions = ["pcs", "box", "lusin", "kg", "gram", "liter", "ml"];

export default function ProdukPage() {
  const { data: session } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Kategori
  const [customCategories, setCustomCategories] = useState<string[]>([
    "Kopi", "Non-Kopi", "Makanan", "Minuman",
  ]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/products?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setProducts(data); })
      .catch(() => showToast("Gagal memuat produk", "err"));
  }, [storeId]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function saveNewCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!customCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
    }
    setForm((f) => ({ ...f, category: trimmed }));
    setNewCategory("");
    setShowAddCategory(false);
  }

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowAddCategory(false);
    setNewCategory("");
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditTarget(product);
    setForm({
      name: product.name,
      barcode: product.barcode ?? "",
      sku: product.sku ?? "",
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() ?? "",
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      unit: product.unit,
      category: product.category ?? "",
      imageUrl: product.imageUrl ?? "",
    });
    // Kalau kategori produk belum ada di list, tambahkan
    if (product.category && !customCategories.includes(product.category)) {
      setCustomCategories((prev) => [...prev, product.category!]);
    }
    setShowAddCategory(false);
    setNewCategory("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    setForm(emptyForm);
    setShowAddCategory(false);
    setNewCategory("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Ukuran gambar maksimal 2MB", "err");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("products")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("products")
        .getPublicUrl(fileName);

      setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
      showToast("Gambar berhasil diupload");
    } catch (err) {
      console.error(err);
      showToast("Upload gambar gagal", "err");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price || !form.stock) return;
    setLoading(true);

    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      sku: form.sku.trim() || null,
      price: parseInt(form.price),
      costPrice: form.costPrice ? parseInt(form.costPrice) : null,
      stock: parseInt(form.stock),
      minStock: parseInt(form.minStock) || 5,
      unit: form.unit || "pcs",
      category: form.category.trim() || null,
      imageUrl: form.imageUrl || null,
      storeId,
    };

    try {
      if (editTarget) {
        const res = await fetch(`/api/products/${editTarget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast("Produk berhasil diperbarui");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const newProduct = await res.json();
        setProducts((prev) => [newProduct, ...prev]);
        showToast("Produk berhasil ditambahkan");
      }
    } catch {
      showToast("Gagal menyimpan produk", "err");
    } finally {
      setLoading(false);
      closeModal();
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast("Produk berhasil dihapus");
    } catch {
      showToast("Gagal menghapus produk", "err");
    } finally {
      setDeleteConfirm(null);
    }
  }

  const profit = form.price && form.costPrice
    ? parseInt(form.price) - parseInt(form.costPrice)
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-medium text-gray-900">Produk</span>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={2}>
            <path d="M8 3v10M3 8h10" stroke="white" strokeLinecap="round" />
          </svg>
          Tambah Produk
        </button>
      </header>

      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, SKU, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm text-black bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 transition-colors"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} produk</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-5 py-3">PRODUK</th>
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">SKU</th>
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">HARGA</th>
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">MARGIN</th>
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">STOK</th>
                <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">STATUS</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                    {products.length === 0 ? "Belum ada produk. Tambah produk pertama kamu!" : "Produk tidak ditemukan"}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const margin = product.costPrice
                    ? Math.round(((product.price - product.costPrice) / product.price) * 100)
                    : null;
                  const isLow = product.stock <= product.minStock;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-base">🛍️</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{product.name}</p>
                            {product.category && (
                              <p className="text-[10px] text-gray-400">{product.category} · {product.unit}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{product.sku ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{formatRupiah(product.price)}</p>
                        {product.costPrice && (
                          <p className="text-[10px] text-gray-400">Modal: {formatRupiah(product.costPrice)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {margin !== null ? <span className="text-emerald-600">{margin}%</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{product.stock} {product.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          product.stock === 0 ? "bg-red-50 text-red-600"
                          : isLow ? "bg-orange-50 text-orange-600"
                          : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {product.stock === 0 ? "Habis" : isLow ? "Menipis" : "Aman"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                              <path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(product.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={1.5}>
                              <path d="M3 4h10M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 w-[480px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-gray-900">{editTarget ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Wajib diisi */}
              <div className="pb-3 border-b border-gray-100">
                <p className="text-[10px] font-medium text-gray-400 tracking-wider mb-3">WAJIB DIISI</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nama Produk <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      placeholder="Contoh: Aqua 600ml"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Harga Jual (Rp) <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        placeholder="7000"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Stok <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        placeholder="100"
                        value={form.stock}
                        onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Opsional */}
              <div>
                <p className="text-[10px] font-medium text-gray-400 tracking-wider mb-3">OPSIONAL</p>
                <div className="space-y-3">

                  {/* Upload Gambar */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Foto Produk</label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {form.imageUrl ? (
                          <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300" fill="none" strokeWidth={1.5}>
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
                            <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer">
                          <div className={`px-3 py-2 text-xs border border-dashed border-gray-300 rounded-lg text-center text-gray-500 transition-colors ${uploading ? "opacity-50" : "hover:border-amber-400 hover:text-amber-700"}`}>
                            {uploading ? "Mengupload..." : form.imageUrl ? "Ganti Gambar" : "Upload Gambar"}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploading}
                          />
                        </label>
                        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, WEBP. Maks 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Barcode</label>
                      <input
                        type="text"
                        placeholder="8999999012345"
                        value={form.barcode}
                        onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                      <input
                        type="text"
                        placeholder="MNM-001"
                        value={form.sku}
                        onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Harga Modal (Rp)</label>
                      <input
                        type="number"
                        placeholder="5000"
                        value={form.costPrice}
                        onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                      {profit !== null && (
                        <p className="text-[10px] text-emerald-600 mt-1">
                          Untung: {formatRupiah(profit)} per item
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Min. Stok Alert</label>
                      <input
                        type="number"
                        placeholder="5"
                        value={form.minStock}
                        onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Satuan</label>
                      <select
                        value={form.unit}
                        onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white"
                      >
                        {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Kategori</label>
                      <div className="flex gap-1.5">
                        <select
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          className="flex-1 px-3 py-2 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white"
                        >
                          <option value="">-- Pilih --</option>
                          {customCategories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAddCategory((v) => !v)}
                          className="px-2 py-2 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
                        >
                          + Baru
                        </button>
                      </div>
                      {showAddCategory && (
                        <div className="flex gap-1.5 mt-2">
                          <input
                            type="text"
                            placeholder="Nama kategori..."
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveNewCategory(); }}
                            className="flex-1 px-3 py-2 text-sm text-black border border-amber-300 rounded-lg outline-none focus:border-amber-400 transition-colors"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={saveNewCategory}
                            className="px-3 py-2 text-xs bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={closeModal} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.price || !form.stock || loading || uploading}
                className="flex-1 py-2 text-sm text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Menyimpan..." : editTarget ? "Simpan Perubahan" : "Tambah Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 w-80 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500" fill="none" strokeWidth={1.5}>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-xs px-4 py-2.5 rounded-full z-50 ${toast.type === "err" ? "bg-red-500" : "bg-gray-900"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}