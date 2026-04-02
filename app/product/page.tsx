"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  emoji: string;
}

const categories = ["Kopi", "Non-Kopi", "Makanan"];

const initialProducts: Product[] = [
  { id: "1", name: "Kopi Susu Gula Aren", price: 27000, stock: 50, category: "Kopi", emoji: "☕" },
  { id: "2", name: "Americano Hot", price: 28000, stock: 50, category: "Kopi", emoji: "☕" },
  { id: "3", name: "Cappuccino", price: 32000, stock: 50, category: "Kopi", emoji: "☕" },
  { id: "4", name: "Es Kopi Hitam", price: 21000, stock: 50, category: "Kopi", emoji: "☕" },
  { id: "5", name: "Matcha Latte", price: 35000, stock: 14, category: "Non-Kopi", emoji: "🍵" },
  { id: "6", name: "Coklat Panas", price: 30000, stock: 20, category: "Non-Kopi", emoji: "🍫" },
  { id: "7", name: "Teh Tarik", price: 18000, stock: 30, category: "Non-Kopi", emoji: "🍵" },
  { id: "8", name: "Lemon Tea", price: 20000, stock: 25, category: "Non-Kopi", emoji: "🍋" },
  { id: "9", name: "Croissant", price: 28000, stock: 8, category: "Makanan", emoji: "🥐" },
  { id: "10", name: "Roti Bakar", price: 22000, stock: 3, category: "Makanan", emoji: "🍞" },
  { id: "11", name: "Banana Foster", price: 35000, stock: 10, category: "Makanan", emoji: "🍌" },
  { id: "12", name: "Cheesecake", price: 40000, stock: 6, category: "Makanan", emoji: "🍰" },
];

const emptyForm = { name: "", price: "", stock: "", category: "Kopi", emoji: "☕" };

function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

function generateId(): string {
  return Date.now().toString();
}

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Semua");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    const matchCat = filterCat === "Semua" || p.category === filterCat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditTarget(product);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      emoji: product.emoji,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    setForm(emptyForm);
  }

  function handleSave() {
    if (!form.name.trim() || !form.price || !form.stock) return;
    if (editTarget) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editTarget.id
            ? { ...p, name: form.name, price: parseInt(form.price), stock: parseInt(form.stock), category: form.category, emoji: form.emoji }
            : p
        )
      );
      showToast("Produk berhasil diperbarui");
    } else {
      const newProduct: Product = {
        id: generateId(),
        name: form.name,
        price: parseInt(form.price),
        stock: parseInt(form.stock),
        category: form.category,
        emoji: form.emoji,
      };
      setProducts((prev) => [newProduct, ...prev]);
      showToast("Produk berhasil ditambahkan");
    }
    closeModal();
  }

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
    showToast("Produk berhasil dihapus");
  }

  const emojiOptions = ["☕", "🍵", "🍫", "🍋", "🥤", "🧃", "🥐", "🍞", "🍌", "🍰", "🍩", "🧇"];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* ✅ Sidebar dari komponen terpisah - otomatis highlight aktif */}

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
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-amber-300 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {["Semua", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === cat ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} produk</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-5 py-3">PRODUK</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">KATEGORI</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">HARGA</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">STOK</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">STATUS</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-gray-400">Tidak ada produk ditemukan</td>
                  </tr>
                ) : (
                  filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{product.emoji}</span>
                          <span className="text-sm font-medium text-gray-800">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{product.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatRupiah(product.price)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{product.stock}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${product.stock > 5 ? "bg-emerald-50 text-emerald-700" : product.stock > 0 ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"}`}>
                          {product.stock > 5 ? "Aman" : product.stock > 0 ? "Menipis" : "Habis"}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-gray-900">{editTarget ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {emojiOptions.map((em) => (
                    <button key={em} onClick={() => setForm((f) => ({ ...f, emoji: em }))} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${form.emoji === em ? "bg-amber-100 border-2 border-amber-400" : "bg-gray-50 hover:bg-gray-100"}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nama Produk</label>
                <input type="text" placeholder="Contoh: Kopi Susu Gula Aren" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Kategori</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white">
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Harga (Rp)</label>
                  <input type="number" placeholder="27000" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Stok</label>
                  <input type="number" placeholder="50" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={closeModal} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.price || !form.stock} className="flex-1 py-2 text-sm text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editTarget ? "Simpan Perubahan" : "Tambah Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2 text-sm text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full z-50">
          {toast}
        </div>
      )}
    </div>
  );
}