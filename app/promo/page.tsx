"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ── TYPES ─────────────────────────────────────────────────
type PromoType = "PRODUCT" | "HAPPY_HOUR" | "MIN_TRANSACTION";
type DiscountType = "PERCENT" | "NOMINAL";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Promo {
  id: string;
  name: string;
  type: PromoType;
  discountType: DiscountType;
  discountValue: number;
  productId?: string | null;
  product?: { id: string; name: string } | null;
  startTime?: string | null;
  endTime?: string | null;
  minTransaction?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  type: "PRODUCT" as PromoType,
  discountType: "PERCENT" as DiscountType,
  discountValue: "",
  productId: "",
  startTime: "",
  endTime: "",
  minTransaction: "",
  startDate: "",
  endDate: "",
};

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function promoTypeLabel(type: PromoType) {
  if (type === "PRODUCT") return "By Produk";
  if (type === "HAPPY_HOUR") return "Happy Hour";
  return "Min. Transaksi";
}

function promoTypeBadgeClass(type: PromoType) {
  if (type === "PRODUCT") return "bg-blue-50 text-blue-600";
  if (type === "HAPPY_HOUR") return "bg-orange-50 text-orange-600";
  return "bg-purple-50 text-purple-600";
}

// ── COMPONENT ─────────────────────────────────────────────
export default function PromoAdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | PromoType>("ALL");
  const [filterActive, setFilterActive] = useState<"ALL" | "active" | "inactive">("ALL");

  // ── FETCH ─────────────────────────────────────────────
  async function fetchPromos() {
    if (!storeId) return;
    setLoading(true);
    const res = await fetch(`/api/promos?storeId=${storeId}&all=true`);
    const data = await res.json();
    setPromos(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchProducts() {
    if (!storeId) return;
    const res = await fetch(`/api/products?storeId=${storeId}`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchPromos();
    fetchProducts();
  }, [storeId]);

  // ── MODAL HELPERS ─────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(promo: Promo) {
    setEditTarget(promo);
    setForm({
      name: promo.name,
      type: promo.type,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      productId: promo.productId ?? "",
      startTime: promo.startTime ?? "",
      endTime: promo.endTime ?? "",
      minTransaction: promo.minTransaction ? String(promo.minTransaction) : "",
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  function setF(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // ── SAVE (create / update) ────────────────────────────
  async function handleSave() {
    if (!form.name.trim() || !form.discountValue) return;
    if (form.type === "HAPPY_HOUR" && (!form.startTime || !form.endTime)) return;

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      productId: form.type === "PRODUCT" && form.productId ? form.productId : null,
      startTime: form.type === "HAPPY_HOUR" ? form.startTime : null,
      endTime: form.type === "HAPPY_HOUR" ? form.endTime : null,
      minTransaction: form.type === "MIN_TRANSACTION" && form.minTransaction ? Number(form.minTransaction) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    if (editTarget) {
      await fetch("/api/promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, ...payload }),
      });
    } else {
      await fetch("/api/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, ...payload }),
      });
    }

    setSaving(false);
    closeModal();
    fetchPromos();
  }

  // ── TOGGLE AKTIF ──────────────────────────────────────
  async function toggleActive(promo: Promo) {
    await fetch("/api/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: promo.id, isActive: !promo.isActive }),
    });
    fetchPromos();
  }

  // ── DELETE ────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/promos?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchPromos();
  }

  // ── FILTER ────────────────────────────────────────────
  const filtered = promos.filter((p) => {
    const matchType = filterType === "ALL" || p.type === filterType;
    const matchActive =
      filterActive === "ALL" ||
      (filterActive === "active" && p.isActive) ||
      (filterActive === "inactive" && !p.isActive);
    return matchType && matchActive;
  });

  // ── RENDER ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" strokeWidth={1.8} stroke="currentColor">
              <path d="M12 4L6 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Manajemen Promo</h1>
            <p className="text-[11px] text-gray-400">{promos.length} promo terdaftar</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Tambah Promo
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* Filter tipe */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden text-xs">
            {(["ALL", "PRODUCT", "HAPPY_HOUR", "MIN_TRANSACTION"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-2 font-medium transition-colors ${filterType === t ? "bg-amber-700 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {t === "ALL" ? "Semua tipe" : promoTypeLabel(t)}
              </button>
            ))}
          </div>

          {/* Filter status */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden text-xs">
            {(["ALL", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterActive(s)}
                className={`px-3 py-2 font-medium transition-colors ${filterActive === s ? "bg-amber-700 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {s === "ALL" ? "Semua status" : s === "active" ? "Aktif" : "Nonaktif"}
              </button>
            ))}
          </div>
        </div>

        {/* ── PROMO LIST ──────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Memuat promo...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-400" fill="none" strokeWidth={1.5} stroke="currentColor">
                <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Belum ada promo</p>
            <p className="text-xs text-gray-400 mt-1">Klik "Tambah Promo" untuk mulai</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((promo) => (
              <div
                key={promo.id}
                className={`bg-white rounded-xl border transition-all ${promo.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}
              >
                <div className="px-5 py-4 flex items-center gap-4">

                  {/* Toggle aktif */}
                  <button
                    onClick={() => toggleActive(promo)}
                    className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${promo.isActive ? "bg-amber-600" : "bg-gray-200"}`}
                    title={promo.isActive ? "Nonaktifkan" : "Aktifkan"}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${promo.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>

                  {/* Info promo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{promo.name}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${promoTypeBadgeClass(promo.type)}`}>
                        {promoTypeLabel(promo.type)}
                      </span>
                      {!promo.isActive && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 flex-shrink-0">
                          Nonaktif
                        </span>
                      )}
                    </div>

                    {/* Detail promo */}
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg viewBox="0 0 14 14" className="w-3 h-3 text-amber-500" fill="none" strokeWidth={1.5} stroke="currentColor">
                          <path d="M7 1v12M1 7h12" strokeLinecap="round"/>
                        </svg>
                        {promo.discountType === "PERCENT"
                          ? `Diskon ${promo.discountValue}%`
                          : `Diskon ${formatRupiah(promo.discountValue)}`}
                      </span>
                      {promo.type === "PRODUCT" && (
                        <span>
                          {promo.product ? `Produk: ${promo.product.name}` : "Semua produk"}
                        </span>
                      )}
                      {promo.type === "HAPPY_HOUR" && (
                        <span>⏰ {promo.startTime}–{promo.endTime}</span>
                      )}
                      {promo.type === "MIN_TRANSACTION" && promo.minTransaction && (
                        <span>Min. {formatRupiah(promo.minTransaction)}</span>
                      )}
                      {(promo.startDate || promo.endDate) && (
                        <span>
                          📅 {promo.startDate ? promo.startDate.slice(0, 10) : "—"}
                          {" s/d "}
                          {promo.endDate ? promo.endDate.slice(0, 10) : "∞"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aksi */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(promo)}
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                      title="Edit"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5} stroke="currentColor">
                        <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(promo.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Hapus"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5} stroke="currentColor">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL TAMBAH / EDIT ─────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {editTarget ? "Edit Promo" : "Tambah Promo Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={2} stroke="currentColor">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Nama promo */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nama Promo *</label>
                <input
                  type="text"
                  placeholder="Contoh: Happy Hour Sore, Promo Akhir Pekan"
                  value={form.name}
                  onChange={(e) => setF("name", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                />
              </div>

              {/* Tipe promo */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipe Promo *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PRODUCT", "HAPPY_HOUR", "MIN_TRANSACTION"] as PromoType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setF("type", t)}
                      className={`py-2.5 px-2 rounded-lg border text-[11px] font-medium text-center transition-colors ${
                        form.type === t
                          ? "bg-amber-700 border-amber-700 text-white"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {t === "PRODUCT" && "📦 By Produk"}
                      {t === "HAPPY_HOUR" && "⏰ Happy Hour"}
                      {t === "MIN_TRANSACTION" && "🧾 Min. Transaksi"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kondisi tambahan by tipe */}
              {form.type === "PRODUCT" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Produk yang didiskon</label>
                  <select
                    value={form.productId}
                    onChange={(e) => setF("productId", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800 bg-white"
                  >
                    <option value="">Semua produk</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatRupiah(p.price)}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.type === "HAPPY_HOUR" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Jam Mulai *</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setF("startTime", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Jam Selesai *</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setF("endTime", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                    />
                  </div>
                </div>
              )}

              {form.type === "MIN_TRANSACTION" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Minimum Transaksi (Rp) *</label>
                  <input
                    type="number"
                    placeholder="Contoh: 100000"
                    value={form.minTransaction}
                    onChange={(e) => setF("minTransaction", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                  />
                </div>
              )}

              {/* Tipe & nilai diskon */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipe Diskon *</label>
                <div className="flex gap-2 mb-3">
                  {(["PERCENT", "NOMINAL"] as DiscountType[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setF("discountType", d)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        form.discountType === d
                          ? "bg-amber-700 border-amber-700 text-white"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {d === "PERCENT" ? "% Persen" : "Rp Nominal"}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {form.discountType === "PERCENT" ? "%" : "Rp"}
                  </span>
                  <input
                    type="number"
                    placeholder={form.discountType === "PERCENT" ? "10 (artinya 10%)" : "10000"}
                    value={form.discountValue}
                    onChange={(e) => setF("discountValue", e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                  />
                </div>
                {form.discountType === "PERCENT" && Number(form.discountValue) > 100 && (
                  <p className="text-[11px] text-red-400 mt-1">Persen maksimal 100</p>
                )}
              </div>

              {/* Masa berlaku */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Masa Berlaku (opsional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Mulai</p>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setF("startDate", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Berakhir</p>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setF("endDate", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Kosongkan untuk promo tanpa batas waktu</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.discountValue}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Menyimpan..." : editTarget ? "Simpan Perubahan" : "Buat Promo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI HAPUS ──────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500" fill="none" strokeWidth={1.5} stroke="currentColor">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 text-center mb-1">Hapus promo ini?</h3>
            <p className="text-xs text-gray-500 text-center mb-5">Data promo akan dihapus permanen dan tidak bisa dikembalikan.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}