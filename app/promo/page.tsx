"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDemoMode } from "@/lib/demo";

// ── TYPES ─────────────────────────────────────────────────
type PromoType = "PRODUCT" | "HAPPY_HOUR" | "MIN_TRANSACTION";
type DiscountType = "PERCENT" | "NOMINAL";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface PromoRule {
  id: string;
  type: PromoType;
  discountType: DiscountType;
  discountValue: number;
  productId?: string | null;
  product?: { id: string; name: string } | null;
  startTime?: string | null;
  endTime?: string | null;
  minTransaction?: number | null;
}

interface Promo {
  id: string;
  name: string;
  tag?: string | null;           // label warna: "red"|"blue"|"green"|"purple"|"orange"
  priority: number;              // urutan evaluasi (1 = tertinggi)
  stackable: boolean;            // bisa digabung dgn promo lain?
  maxUsage?: number | null;      // batas pemakaian total
  usageCount: number;            // sudah dipakai berapa kali
  rules: PromoRule[];            // ← multi-rule per promo
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── EMPTY STATES ──────────────────────────────────────────
const EMPTY_RULE: Omit<PromoRule, "id"> = {
  type: "PRODUCT",
  discountType: "PERCENT",
  discountValue: 0,
  productId: "",
  startTime: "",
  endTime: "",
  minTransaction: 0,
};

const EMPTY_FORM = {
  name: "",
  tag: "",
  priority: 1,
  stackable: false,
  maxUsage: "",
  startDate: "",
  endDate: "",
  rules: [{ ...EMPTY_RULE, id: crypto.randomUUID() }] as (PromoRule & { id: string })[],
};

// ── HELPERS ───────────────────────────────────────────────
function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function promoTypeLabel(type: PromoType) {
  if (type === "PRODUCT") return "By Produk";
  if (type === "HAPPY_HOUR") return "Happy Hour";
  return "Min. Transaksi";
}

function promoTypeIcon(type: PromoType) {
  if (type === "PRODUCT") return "📦";
  if (type === "HAPPY_HOUR") return "⏰";
  return "🧾";
}

const TAG_OPTIONS = [
  { value: "", label: "Tanpa Tag" },
  { value: "red", label: "🔴 Merah" },
  { value: "orange", label: "🟠 Oranye" },
  { value: "blue", label: "🔵 Biru" },
  { value: "green", label: "🟢 Hijau" },
  { value: "purple", label: "🟣 Ungu" },
];

const TAG_CLASSES: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-200",
  orange: "bg-orange-50 text-orange-600 border-orange-200",
  blue: "bg-blue-50 text-blue-600 border-blue-200",
  green: "bg-green-50 text-green-600 border-green-200",
  purple: "bg-purple-50 text-purple-600 border-purple-200",
};

const TAG_DOT: Record<string, string> = {
  red: "bg-red-400",
  orange: "bg-orange-400",
  blue: "bg-blue-400",
  green: "bg-green-400",
  purple: "bg-purple-500",
};

// ── COMPONENT ─────────────────────────────────────────────
export default function PromoAdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { demoStoreId } = useDemoMode();
  const storeId = (session?.user as any)?.storeId ?? demoStoreId;

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      tag: promo.tag ?? "",
      priority: promo.priority,
      stackable: promo.stackable,
      maxUsage: promo.maxUsage ? String(promo.maxUsage) : "",
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : "",
      rules: promo.rules.map((r) => ({
        id: r.id,
        type: r.type,
        discountType: r.discountType,
        discountValue: r.discountValue,
        productId: r.productId ?? "",
        startTime: r.startTime ?? "",
        endTime: r.endTime ?? "",
        minTransaction: r.minTransaction ?? 0,
      })),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  function setF(key: string, val: any) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // ── RULE HELPERS ──────────────────────────────────────
  function addRule() {
    setForm((prev) => ({
      ...prev,
      rules: [...prev.rules, { ...EMPTY_RULE, id: crypto.randomUUID() }],
    }));
  }

  function removeRule(ruleId: string) {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
  }

  function setRule(ruleId: string, key: string, val: any) {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, [key]: val } : r)),
    }));
  }

  function moveRuleUp(idx: number) {
    if (idx === 0) return;
    setForm((prev) => {
      const rules = [...prev.rules];
      [rules[idx - 1], rules[idx]] = [rules[idx], rules[idx - 1]];
      return { ...prev, rules };
    });
  }

  function moveRuleDown(idx: number) {
    setForm((prev) => {
      if (idx >= prev.rules.length - 1) return prev;
      const rules = [...prev.rules];
      [rules[idx], rules[idx + 1]] = [rules[idx + 1], rules[idx]];
      return { ...prev, rules };
    });
  }

  // ── SAVE (create / update) ────────────────────────────
  async function handleSave() {
    if (!form.name.trim() || form.rules.length === 0) return;

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      tag: form.tag || null,
      priority: Number(form.priority),
      stackable: form.stackable,
      maxUsage: form.maxUsage ? Number(form.maxUsage) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      rules: form.rules.map((r) => ({
        id: r.id,
        type: r.type,
        discountType: r.discountType,
        discountValue: Number(r.discountValue),
        productId: r.type === "PRODUCT" && r.productId ? r.productId : null,
        startTime: r.type === "HAPPY_HOUR" ? r.startTime : null,
        endTime: r.type === "HAPPY_HOUR" ? r.endTime : null,
        minTransaction: r.type === "MIN_TRANSACTION" && r.minTransaction ? Number(r.minTransaction) : null,
      })),
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
  const filtered = promos
    .filter((p) => {
      const matchType =
        filterType === "ALL" || p.rules.some((r) => r.type === filterType);
      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "active" && p.isActive) ||
        (filterActive === "inactive" && !p.isActive);
      return matchType && matchActive;
    })
    .sort((a, b) => a.priority - b.priority);

  // ── RENDER ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" strokeWidth={1.8} stroke="currentColor">
              <path d="M12 4L6 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Manajemen Promo</h1>
            <p className="text-[11px] text-gray-400">{promos.length} promo terdaftar · diurutkan by prioritas</p>
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

        {/* Priority legend */}
        <div className="flex items-center gap-2 mb-4 text-[11px] text-gray-400">
          <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" strokeWidth={1.5} stroke="currentColor">
            <path d="M7 1v12M4 4l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Promo diurutkan by prioritas — angka lebih kecil = dievaluasi lebih dulu
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
            {filtered.map((promo, idx) => (
              <div
                key={promo.id}
                className={`bg-white rounded-xl border transition-all ${promo.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}
              >
                {/* ── Card header ── */}
                <div className="px-5 py-4 flex items-center gap-4">

                  {/* Priority badge */}
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-500">#{promo.priority}</span>
                  </div>

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
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      {/* Tag warna */}
                      {promo.tag && (
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TAG_DOT[promo.tag] ?? "bg-gray-300"}`} />
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">{promo.name}</p>

                      {/* Stackable badge */}
                      {promo.stackable && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 flex-shrink-0">
                          ⚡ Stackable
                        </span>
                      )}

                      {!promo.isActive && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 flex-shrink-0">
                          Nonaktif
                        </span>
                      )}
                    </div>

                    {/* Meta: aturan count + usage + tanggal */}
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                      <span
                        className="cursor-pointer underline underline-offset-2 hover:text-amber-700 transition-colors"
                        onClick={() => setExpandedId(expandedId === promo.id ? null : promo.id)}
                      >
                        {promo.rules.length} aturan diskon
                      </span>
                      {promo.maxUsage && (
                        <span>
                          🔢 {promo.usageCount}/{promo.maxUsage}x dipakai
                        </span>
                      )}
                      {(promo.startDate || promo.endDate) && (
                        <span>
                          📅 {promo.startDate ? promo.startDate.slice(0, 10) : "—"} s/d {promo.endDate ? promo.endDate.slice(0, 10) : "∞"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aksi */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === promo.id ? null : promo.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      title="Lihat aturan"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={`w-4 h-4 transition-transform ${expandedId === promo.id ? "rotate-180" : ""}`}
                        fill="none"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEdit(promo)}
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                      title="Edit"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5} stroke="currentColor">
                        <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(promo.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Hapus"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5} stroke="currentColor">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Expanded: daftar rules ── */}
                {expandedId === promo.id && (
                  <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Aturan Diskon</p>
                    <div className="space-y-2">
                      {promo.rules.map((rule, ri) => (
                        <div key={rule.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                          <span className="text-sm">{promoTypeIcon(rule.type)}</span>
                          <div className="flex-1 text-[11px] text-gray-600">
                            <span className="font-medium">{promoTypeLabel(rule.type)}</span>
                            <span className="mx-1.5 text-gray-300">·</span>
                            {rule.discountType === "PERCENT"
                              ? `Diskon ${rule.discountValue}%`
                              : `Diskon ${formatRupiah(rule.discountValue)}`}
                            {rule.type === "PRODUCT" && rule.product && (
                              <><span className="mx-1.5 text-gray-300">·</span>{rule.product.name}</>
                            )}
                            {rule.type === "HAPPY_HOUR" && (
                              <><span className="mx-1.5 text-gray-300">·</span>{rule.startTime}–{rule.endTime}</>
                            )}
                            {rule.type === "MIN_TRANSACTION" && rule.minTransaction && (
                              <><span className="mx-1.5 text-gray-300">·</span>Min. {formatRupiah(rule.minTransaction)}</>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">#{ri + 1}</span>
                        </div>
                      ))}
                    </div>

                    {/* Max usage progress bar */}
                    {promo.maxUsage && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                          <span>Kuota pemakaian</span>
                          <span>{promo.usageCount}/{promo.maxUsage}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min((promo.usageCount / promo.maxUsage) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL TAMBAH / EDIT ─────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {editTarget ? "Edit Promo" : "Tambah Promo Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={2} stroke="currentColor">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* ── Nama ── */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nama Promo *</label>
                <input
                  type="text"
                  placeholder="Contoh: Paket Hemat Akhir Pekan"
                  value={form.name}
                  onChange={(e) => setF("name", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                />
              </div>

              {/* ── Tag warna + Priority + Stackable (1 baris) ── */}
              <div className="grid grid-cols-3 gap-3">
                {/* Tag */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tag Warna</label>
                  <select
                    value={form.tag}
                    onChange={(e) => setF("tag", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800 bg-white"
                  >
                    {TAG_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Prioritas *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.priority}
                    onChange={(e) => setF("priority", Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Lebih kecil = lebih dulu</p>
                </div>

                {/* Stackable */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Stackable?</label>
                  <button
                    onClick={() => setF("stackable", !form.stackable)}
                    className={`w-full py-2.5 text-xs font-medium rounded-lg border transition-colors ${
                      form.stackable
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "border-gray-200 text-gray-500"
                    }`}
                  >
                    {form.stackable ? "⚡ Ya, stackable" : "Tidak"}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1">Bisa digabung promo lain</p>
                </div>
              </div>

              {/* ── Max Usage ── */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Batas Pemakaian (opsional)</label>
                <input
                  type="number"
                  placeholder="Kosongkan = tidak terbatas"
                  value={form.maxUsage}
                  onChange={(e) => setF("maxUsage", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors text-gray-800"
                />
              </div>

              {/* ── Masa berlaku ── */}
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
              </div>

              {/* ── RULES ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Aturan Diskon *</label>
                  <button
                    onClick={addRule}
                    className="text-[11px] font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors"
                  >
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" strokeWidth={2} stroke="currentColor">
                      <path d="M6 2v8M2 6h8" strokeLinecap="round" />
                    </svg>
                    Tambah Aturan
                  </button>
                </div>

                <div className="space-y-3">
                  {form.rules.map((rule, idx) => (
                    <div key={rule.id} className="border border-gray-200 rounded-xl p-4 space-y-3">

                      {/* Rule header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Aturan #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* Move up/down */}
                          <button
                            onClick={() => moveRuleUp(idx)}
                            disabled={idx === 0}
                            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
                              <path d="M2 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveRuleDown(idx)}
                            disabled={idx === form.rules.length - 1}
                            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
                              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {/* Remove rule */}
                          {form.rules.length > 1 && (
                            <button
                              onClick={() => removeRule(rule.id)}
                              className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
                                <path d="M2 2l8 8M10 2L2 10" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tipe promo */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["PRODUCT", "HAPPY_HOUR", "MIN_TRANSACTION"] as PromoType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setRule(rule.id, "type", t)}
                            className={`py-2 px-1 rounded-lg border text-[10px] font-medium text-center transition-colors ${
                              rule.type === t
                                ? "bg-amber-700 border-amber-700 text-white"
                                : "border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {promoTypeIcon(t)} {t === "PRODUCT" ? "Produk" : t === "HAPPY_HOUR" ? "Happy Hour" : "Min. Transaksi"}
                          </button>
                        ))}
                      </div>

                      {/* Kondisi by tipe */}
                      {rule.type === "PRODUCT" && (
                        <select
                          value={rule.productId ?? ""}
                          onChange={(e) => setRule(rule.id, "productId", e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 text-gray-800 bg-white"
                        >
                          <option value="">Semua produk</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {formatRupiah(p.price)}</option>
                          ))}
                        </select>
                      )}

                      {rule.type === "HAPPY_HOUR" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Jam Mulai *</p>
                            <input
                              type="time"
                              value={rule.startTime ?? ""}
                              onChange={(e) => setRule(rule.id, "startTime", e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 text-gray-800"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Jam Selesai *</p>
                            <input
                              type="time"
                              value={rule.endTime ?? ""}
                              onChange={(e) => setRule(rule.id, "endTime", e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 text-gray-800"
                            />
                          </div>
                        </div>
                      )}

                      {rule.type === "MIN_TRANSACTION" && (
                        <input
                          type="number"
                          placeholder="Minimum transaksi (Rp)"
                          value={rule.minTransaction ?? ""}
                          onChange={(e) => setRule(rule.id, "minTransaction", e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 text-gray-800"
                        />
                      )}

                      {/* Tipe & nilai diskon */}
                      <div className="flex gap-2">
                        {(["PERCENT", "NOMINAL"] as DiscountType[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setRule(rule.id, "discountType", d)}
                            className={`flex-1 py-2 rounded-lg border text-[11px] font-medium transition-colors ${
                              rule.discountType === d
                                ? "bg-amber-700 border-amber-700 text-white"
                                : "border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {d === "PERCENT" ? "% Persen" : "Rp Nominal"}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {rule.discountType === "PERCENT" ? "%" : "Rp"}
                        </span>
                        <input
                          type="number"
                          placeholder={rule.discountType === "PERCENT" ? "10" : "10000"}
                          value={rule.discountValue || ""}
                          onChange={(e) => setRule(rule.id, "discountValue", e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 text-gray-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add rule hint */}
                <button
                  onClick={addRule}
                  className="mt-2 w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors"
                >
                  + Tambah aturan diskon lagi
                </button>
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
                disabled={saving || !form.name.trim() || form.rules.length === 0}
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
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500" fill="none" strokeWidth={1.5} stroke="currentColor">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 text-center mb-1">Hapus promo ini?</h3>
            <p className="text-xs text-gray-500 text-center mb-5">
              Semua aturan diskon di dalam promo ini akan dihapus permanen.
            </p>
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
