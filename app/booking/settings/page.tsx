"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlanPageGate } from "@/components/PlanPageGate";
import { bookingApi } from "@/lib/booking/api";
import { buildTimeSlots, formatCurrency } from "@/lib/booking/format";
import { useStoreIdentity } from "@/lib/booking/use-store-id";
import { usePlanAccess } from "@/lib/use-plan-access";
import type { BookingProduct, BookingSettingsResponse } from "@/lib/booking/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Toggle,
} from "@/components/booking/ui";

type SettingsForm = {
  bookingOpenTime: string;
  bookingCloseTime: string;
  bookingSlotMinutes: number;
  bookingGraceMinutes: number;
};

function getToday(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

export default function BookingSettingsPage() {
  const { loading: planLoading, hasFeatureAccess } = usePlanAccess("booking");
  const { storeId, ready, status } = useStoreIdentity();
  const [data, setData] = useState<BookingSettingsResponse | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productSavingId, setProductSavingId] = useState("");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError("");
    try {
      const result = await bookingApi.getSettings(storeId);
      setData(result);
      setForm({
        bookingOpenTime: result.bookingOpenTime,
        bookingCloseTime: result.bookingCloseTime,
        bookingSlotMinutes: result.bookingSlotMinutes,
        bookingGraceMinutes: result.bookingGraceMinutes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengaturan booking.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!ready) { setLoading(false); return; }
    void load();
  }, [load, ready, status]);

  const slotPreview = useMemo(() => {
    if (!form) return [];
    return buildTimeSlots(form.bookingOpenTime, form.bookingCloseTime, form.bookingSlotMinutes).slice(0, 20);
  }, [form]);

  const totalSlots = useMemo(() => {
    if (!form) return 0;
    return buildTimeSlots(form.bookingOpenTime, form.bookingCloseTime, form.bookingSlotMinutes).length;
  }, [form]);

  if (planLoading) return <PlanPageGate feature="booking" featureName="Booking" />;
  if (!hasFeatureAccess) return <PlanPageGate feature="booking" featureName="Booking" />;

  async function handleSave() {
    if (!form || !storeId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await bookingApi.updateSettings({ storeId, ...form });
      setData(updated);
      setForm({
        bookingOpenTime: updated.bookingOpenTime,
        bookingCloseTime: updated.bookingCloseTime,
        bookingSlotMinutes: updated.bookingSlotMinutes,
        bookingGraceMinutes: updated.bookingGraceMinutes,
      });
      setNotice("Pengaturan booking berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan booking.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(
    product: BookingProduct,
    payload: { bookingEnabled?: boolean; bookingDurationMin?: number | null }
  ) {
    setProductSavingId(product.id);
    setError("");
    try {
      await bookingApi.updateProduct(product.id, payload);
      setData((current) =>
        current
          ? { ...current, products: current.products.map((e) => (e.id === product.id ? { ...e, ...payload } : e)) }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah pengaturan produk booking.");
    } finally {
      setProductSavingId("");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Memuat pengaturan booking..." />
        </div>
      </div>
    );
  }

  if (!ready || !data || !form) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-6">
          {error
            ? <ErrorState description={error} retry={() => void load()} />
            : <EmptyState title="Store belum ditemukan" description="Pastikan akun aktif memiliki store." />
          }
        </div>
      </div>
    );
  }

  const activeProducts = data.products.filter((p) => p.bookingEnabled).length;
  const publicBookingKey = data.slug || data.id;
  const publicBookingHref = `/book/${publicBookingKey}`;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/booking" className="font-medium text-gray-900 hover:text-amber-700 transition-colors">
              Booking
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">Pengaturan</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={publicBookingHref}
              target="_blank"
              className="text-xs bg-white text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full font-semibold hover:bg-amber-50 transition-colors"
            >
              Buka halaman publik
            </Link>
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{getToday()}</span>
            <button
              disabled={saving}
              onClick={() => void handleSave()}
              className="text-xs bg-amber-700 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-amber-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Jam operasional</p>
              <p className="text-xl font-medium text-gray-900">{form.bookingOpenTime} – {form.bookingCloseTime}</p>
              <p className="text-xs text-gray-400 mt-1">jam buka & tutup</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Total slot / hari</p>
              <p className="text-xl font-medium text-gray-900">{totalSlots}</p>
              <p className="text-xs text-gray-400 mt-1">interval {form.bookingSlotMinutes} menit</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Grace period</p>
              <p className="text-xl font-medium text-gray-900">{form.bookingGraceMinutes} menit</p>
              <p className="text-xs text-gray-400 mt-1">toleransi keterlambatan</p>
            </div>
            <div className={`rounded-xl p-4 border shadow-lg ${activeProducts > 0 ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-400 mb-1">Produk booking aktif</p>
              <p className={`text-xl font-medium ${activeProducts > 0 ? "text-emerald-700" : "text-gray-900"}`}>{activeProducts}</p>
              <p className={`text-xs mt-1 ${activeProducts > 0 ? "text-emerald-500" : "text-gray-400"}`}>
                dari {data.products.length} produk
              </p>
            </div>
          </div>

          {error && <ErrorState description={error} retry={() => void load()} />}

          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
              ✓ {notice}
            </div>
          )}

          {/* Booking window + preview slot — 2 kolom sejajar */}
          <div className="grid grid-cols-2 gap-4">

            {/* Booking window form */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
              <p className="text-xs font-medium text-gray-400 tracking-wider mb-4">BOOKING WINDOW</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Jam buka", key: "bookingOpenTime" as const, type: "time" },
                  { label: "Jam tutup", key: "bookingCloseTime" as const, type: "time" },
                  { label: "Interval slot (menit)", key: "bookingSlotMinutes" as const, type: "number" },
                  { label: "Grace period (menit)", key: "bookingGraceMinutes" as const, type: "number" },
                ].map(({ label, key, type }) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>
                    <input
                      type={type}
                      min={type === "number" ? 0 : undefined}
                      step={type === "number" ? 5 : undefined}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((c) =>
                          c ? {
                            ...c,
                            [key]: type === "number" ? Math.max(0, Number(e.target.value) || 0) : e.target.value,
                          } : c
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900"
                    />
                  </label>
                ))}
              </div>

              {/* Store info */}
              <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 gap-2">
                {[
                  { label: "Nama toko", value: data.name },
                  { label: "Slug", value: data.slug || "(otomatis pakai ID store)" },
                  { label: "Tipe bisnis", value: data.type },
                  { label: "Resource aktif", value: `${data.bookingResources.filter((r) => r.isActive).length} resource` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-900 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Slot preview */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider">PREVIEW SLOT</p>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5 font-semibold">
                  {totalSlots} slot / hari
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slotPreview.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-600"
                  >
                    {slot}
                  </span>
                ))}
                {totalSlots > 20 && (
                  <span className="rounded-lg border border-dashed border-gray-200 px-2.5 py-1 text-[10px] text-gray-400">
                    +{totalSlots - 20} lagi
                  </span>
                )}
              </div>
              <p className="mt-4 text-[10px] text-gray-400">
                Preview menampilkan 20 slot pertama. Ubah jam & interval di sebelah kiri untuk update.
              </p>
            </div>
          </div>

          {/* Product settings — full width */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div>
                <p className="text-xs font-medium text-gray-400 tracking-wider">PRODUK BOOKING</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Aktifkan produk yang bisa dipilih customer saat booking</p>
              </div>
              <span className="text-[10px] text-gray-400">{data.products.length} produk</span>
            </div>

            {data.products.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="Belum ada produk"
                  description="Tambahkan produk di menu Produk terlebih dahulu, lalu aktifkan fitur booking per produk di sini."
                />
              </div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[1.8fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-3 px-4 py-2.5 border-b border-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  <span>Produk</span>
                  <span>Kategori</span>
                  <span>Harga</span>
                  <span>Booking</span>
                  <span>Durasi (menit)</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.products.map((product) => (
                    <div
                      key={product.id}
                      className="grid md:grid-cols-[1.8fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-3 px-4 py-3.5 items-center hover:bg-gray-50/60 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{product.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{product.id.slice(0, 12)}…</p>
                      </div>
                      <span className="text-[10px] text-gray-600">{product.category || "—"}</span>
                      <span className="text-xs font-medium text-amber-700">{formatCurrency(product.price)}</span>
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={product.bookingEnabled}
                          disabled={productSavingId === product.id}
                          onChange={() => void updateProduct(product, { bookingEnabled: !product.bookingEnabled })}
                        />
                        <span className={`text-[10px] font-medium ${product.bookingEnabled ? "text-emerald-600" : "text-gray-400"}`}>
                          {product.bookingEnabled ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        disabled={!product.bookingEnabled || productSavingId === product.id}
                        value={product.bookingDurationMin ?? ""}
                        onChange={(e) =>
                          setData((c) =>
                            c ? {
                              ...c,
                              products: c.products.map((entry) =>
                                entry.id === product.id
                                  ? { ...entry, bookingDurationMin: e.target.value ? Number(e.target.value) : null }
                                  : entry
                              ),
                            } : c
                          )
                        }
                        onBlur={(e) =>
                          void updateProduct(product, {
                            bookingDurationMin: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-300"
                        placeholder="30"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
