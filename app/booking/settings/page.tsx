"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bookingApi } from "@/lib/booking/api";
import { buildTimeSlots, formatCurrency } from "@/lib/booking/format";
import { useStoreIdentity } from "@/lib/booking/use-store-id";
import type { BookingProduct, BookingSettingsResponse } from "@/lib/booking/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionCard,
  Toggle,
} from "@/components/booking/ui";

type SettingsForm = {
  bookingOpenTime: string;
  bookingCloseTime: string;
  bookingSlotMinutes: number;
  bookingGraceMinutes: number;
};

export default function BookingSettingsPage() {
  const { storeId, ready, status } = useStoreIdentity();
  const [data, setData] = useState<BookingSettingsResponse | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productSavingId, setProductSavingId] = useState("");

  async function load() {
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
  }

  useEffect(() => {
    if (status === "loading") return;
    if (!ready) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, status, storeId]);

  const slotPreview = useMemo(() => {
    if (!form) return [];
    return buildTimeSlots(form.bookingOpenTime, form.bookingCloseTime, form.bookingSlotMinutes).slice(0, 20);
  }, [form]);

  async function handleSave() {
    if (!form || !storeId) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await bookingApi.updateSettings({ storeId, ...form });
      setData((current) => (current ? { ...current, ...updated } : current));
      setNotice("Pengaturan booking berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan booking.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(product: BookingProduct, payload: { bookingEnabled?: boolean; bookingDurationMin?: number | null }) {
    setProductSavingId(product.id);
    setError("");

    try {
      await bookingApi.updateProduct(product.id, payload);
      setData((current) =>
        current
          ? {
              ...current,
              products: current.products.map((entry) =>
                entry.id === product.id ? { ...entry, ...payload } : entry
              ),
            }
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
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <LoadingState label="Memuat pengaturan booking..." />
      </div>
    );
  }

  if (!ready || !data || !form) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {error ? (
          <ErrorState description={error} retry={() => void load()} />
        ) : (
          <EmptyState
            title="Store belum ditemukan"
            description="Pastikan akun aktif memiliki store yang bisa diakses untuk mengelola booking."
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/booking" className="transition hover:text-slate-900">
                Booking
              </Link>
              <span>/</span>
              <span>Pengaturan</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Booking Settings</h1>
            <p className="mt-2 text-sm text-slate-500">
              Kelola jam operasional booking, interval slot, toleransi keterlambatan, dan produk yang bisa dipilih saat reservasi.
            </p>
          </div>

          <button
            disabled={saving}
            onClick={handleSave}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </div>

        {error ? <ErrorState description={error} retry={() => void load()} /> : null}
        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <SectionCard
            title="Store Overview"
            description="Ringkasan data utama store yang akan dipakai frontend booking."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="Nama toko" value={data.name} />
              <InfoItem label="Slug public" value={data.slug} />
              <InfoItem label="Tipe bisnis" value={data.type} />
              <InfoItem label="Resource aktif" value={`${data.bookingResources.filter((item) => item.isActive).length} resource`} />
            </div>
          </SectionCard>

          <SectionCard title="Preview Slot" description="Slot otomatis mengikuti jam buka dan interval dari backend.">
            <div className="flex flex-wrap gap-2">
              {slotPreview.map((slot) => (
                <span key={slot} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  {slot}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Total {buildTimeSlots(form.bookingOpenTime, form.bookingCloseTime, form.bookingSlotMinutes).length} slot per hari.
            </p>
          </SectionCard>
        </div>

        <SectionCard
          title="Booking Window"
          description="Pengaturan jam operasional yang dipakai oleh availability checker dan jadwal booking."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Jam buka">
              <input
                type="time"
                value={form.bookingOpenTime}
                onChange={(event) => setForm((current) => (current ? { ...current, bookingOpenTime: event.target.value } : current))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </Field>
            <Field label="Jam tutup">
              <input
                type="time"
                value={form.bookingCloseTime}
                onChange={(event) => setForm((current) => (current ? { ...current, bookingCloseTime: event.target.value } : current))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </Field>
            <Field label="Interval slot (menit)">
              <input
                type="number"
                min={5}
                step={5}
                value={form.bookingSlotMinutes}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, bookingSlotMinutes: Number(event.target.value) || current.bookingSlotMinutes } : current
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </Field>
            <Field label="Grace period (menit)">
              <input
                type="number"
                min={0}
                step={5}
                value={form.bookingGraceMinutes}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, bookingGraceMinutes: Number(event.target.value) || 0 } : current
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Booking Product Settings"
          description="Aktifkan hanya produk yang boleh dipilih customer saat membuat booking online."
        >
          {data.products.length === 0 ? (
            <EmptyState
              title="Belum ada produk"
              description="Tambahkan produk di menu Produk terlebih dahulu, lalu aktifkan fitur booking per produk di sini."
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Produk</span>
                <span>Kategori</span>
                <span>Harga</span>
                <span>Booking</span>
                <span>Durasi</span>
              </div>
              <div className="divide-y divide-slate-100">
                {data.products.map((product) => (
                  <div key={product.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr] md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {product.id}</p>
                    </div>
                    <div className="text-sm text-slate-600">{product.category || "-"}</div>
                    <div className="text-sm font-medium text-slate-900">{formatCurrency(product.price)}</div>
                    <div className="flex items-center gap-3">
                      <Toggle
                        checked={product.bookingEnabled}
                        disabled={productSavingId === product.id}
                        onChange={() => void updateProduct(product, { bookingEnabled: !product.bookingEnabled })}
                      />
                      <span className="text-sm text-slate-600">{product.bookingEnabled ? "Aktif" : "Nonaktif"}</span>
                    </div>
                    <label className="block">
                      <input
                        type="number"
                        min={5}
                        step={5}
                        disabled={!product.bookingEnabled || productSavingId === product.id}
                        value={product.bookingDurationMin ?? ""}
                        onChange={(event) =>
                          setData((current) =>
                            current
                              ? {
                                  ...current,
                                  products: current.products.map((entry) =>
                                    entry.id === product.id
                                      ? {
                                          ...entry,
                                          bookingDurationMin: event.target.value ? Number(event.target.value) : null,
                                        }
                                      : entry
                                  ),
                                }
                              : current
                          )
                        }
                        onBlur={(event) =>
                          void updateProduct(product, {
                            bookingDurationMin: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                        placeholder="30"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
