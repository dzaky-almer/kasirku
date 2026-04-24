"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { useParams, useRouter } from "next/navigation";
import { bookingApi } from "@/lib/booking/api";
import { BookingFlowProvider, useBookingFlow } from "@/lib/booking/flow-context";
import {
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  normalizePhone,
  RESOURCE_TYPE_LABEL,
  shiftDate,
  todayInJakarta,
} from "@/lib/booking/format";
import type { AvailabilitySlot } from "@/lib/booking/types";
import { EmptyState, ErrorState, LoadingState, SectionCard } from "@/components/booking/ui";
import { BookingStepper } from "@/components/booking/public/booking-stepper";

type SnapCallbacks = {
  onSuccess: () => void | Promise<void>;
  onPending: () => void;
  onError: () => void;
  onClose: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: SnapCallbacks) => void;
    };
  }
}

const STEPS = ["Tanggal", "Resource", "Layanan", "Data", "Bayar"];

export default function PublicBookingPage() {
  return (
    <BookingFlowProvider>
      <BookingPageContent />
    </BookingFlowProvider>
  );
}

function BookingPageContent() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const flow = useBookingFlow();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [midtrans, setMidtrans] = useState<{ clientKey: string; isProduction: boolean } | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  async function loadStore() {
    setLoading(true);
    setError("");
    try {
      const store = await bookingApi.getPublicStore(slug);
      flow.setStore(store);
      if (!flow.date) flow.setDate(todayInJakarta());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat halaman booking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    let active = true;
    async function initStore() {
      setLoading(true);
      setError("");
      try {
        const store = await bookingApi.getPublicStore(slug);
        if (!active) return;
        flow.setStore(store);
        if (!flow.date) flow.setDate(todayInJakarta());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat halaman booking.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initStore();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!flow.store?.id) return;
    bookingApi.getMidtransConfig(flow.store.id).then((result) => setMidtrans(result)).catch(() => null);
  }, [flow.store?.id]);

  useEffect(() => {
    if (!flow.store || !flow.resourceId || !flow.date) return;
    let active = true;
    async function loadAvailability() {
      setLoadingSlots(true);
      setError("");
      try {
        const params = new URLSearchParams({
          date: flow.date,
          resourceId: flow.resourceId,
          pax: String(flow.pax),
        });
        if (flow.totalDuration > 0) params.set("durationMinutes", String(flow.totalDuration));
        const response = await bookingApi.getAvailability(slug, params);
        if (!active) return;
        setSlots(response.slots);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat slot tersedia.");
        setSlots([]);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    void loadAvailability();
    return () => { active = false; };
  }, [flow.date, flow.pax, flow.resourceId, flow.store?.id, flow.totalDuration, slug]);

  const filteredResources = useMemo(() => {
    if (!flow.store) return [];
    return flow.store.bookingResources.filter((resource) => {
      if (resource.type === "BARBER" || !resource.capacity) return true;
      return resource.capacity >= flow.pax;
    });
  }, [flow.pax, flow.store?.bookingResources]);

  const defaultDuration = flow.store?.bookingSlotMinutes ?? 30;
  const canContinue = [
    Boolean(flow.date),
    Boolean(flow.resourceId && flow.slot),
    flow.selectedProducts.length > 0,
    Boolean(flow.customerName.trim() && flow.customerPhone.trim()),
    true,
  ];

  async function handleSubmit() {
    if (!flow.store || !flow.resourceId || !flow.slot || flow.selectedProducts.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const phone = normalizePhone(flow.customerPhone);
      const created = await bookingApi.createPublicBooking(slug, {
        customerName: flow.customerName.trim(),
        customerPhone: phone,
        customerNote: flow.customerNote.trim(),
        bookingDate: flow.date,
        startTime: flow.slot,
        resourceId: flow.resourceId,
        pax: flow.pax,
        items: flow.selectedProducts.map((item) => ({ productId: item.id, qty: item.qty })),
      });
      const payment = await bookingApi.createMidtransTransaction({
        bookingId: created.booking.id,
        orderId: created.payment.orderId,
        total: created.payment.grossAmount,
        storeId: flow.store.id,
        itemDetails: flow.selectedProducts.map((item) => ({
          id: item.id, price: item.price, quantity: item.qty, name: item.name,
        })),
        customer: { first_name: flow.customerName.trim(), phone },
      });
      setMidtrans({ clientKey: payment.clientKey, isProduction: payment.isProduction });
      if (!window.snap) throw new Error("Widget pembayaran belum siap. Coba ulang beberapa detik lagi.");
      window.snap.pay(payment.token, {
        onSuccess: async () => {
          await bookingApi.confirmPublicBooking(slug, created.booking.id);
          flow.resetSelectionAfterBooking();
          router.push(`/book/${slug}/success?id=${created.booking.id}`);
        },
        onPending: () => { router.push(`/book/${slug}/success?id=${created.booking.id}&status=pending`); },
        onError: () => { setError("Pembayaran gagal. Silakan coba lagi."); setSubmitting(false); },
        onClose: () => { setSubmitting(false); },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat booking.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <LoadingState label="Memuat halaman booking..." />
      </div>
    );
  }

  if (!flow.store) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 px-4">
        <ErrorState description={error || "Store booking tidak ditemukan."} retry={() => void loadStore()} />
      </div>
    );
  }

  const selectedDateLabel = formatDateLabel(flow.date || todayInJakarta(), {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return (
    <>
      {midtrans ? (
        <Script
          src={`${midtrans.isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"}/snap/snap.js`}
          data-client-key={midtrans.clientKey}
          strategy="afterInteractive"
        />
      ) : null}

      {/* ── Root: sama persis dengan dashboard ── */}
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Header: identik dengan dashboard ── */}
          <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">{flow.store.name}</span>
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                Online Booking
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TopPill label={flow.store.type} />
              <TopPill label={flow.store.slug} />
              {flow.store.waNumber ? <TopPill label={flow.store.waNumber} /> : null}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-5">

            {/* ── Banner info + stepper ── */}
            <div className="grid grid-cols-3 gap-3 mb-5">

              {/* Info + stepper */}
              <div className="col-span-2 bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">Booking Customer</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Pilih tanggal, resource, layanan, lalu lanjutkan pembayaran DP untuk mengunci reservasi.
                    </p>
                  </div>
                  <div className="flex-shrink-0 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 min-w-[200px]">
                    <p className="text-[10px] font-medium text-amber-700 tracking-widest uppercase mb-1">Jadwal dipilih</p>
                    <p className="text-sm font-medium text-gray-900">{selectedDateLabel}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Slot interval {flow.store.bookingSlotMinutes} menit</p>
                  </div>
                </div>
                {/* Stepper — pakai bg-gray-100 persis dashboard */}
                <div className="bg-gray-100 rounded-xl p-3">
                  <BookingStepper currentStep={step} steps={STEPS} />
                </div>
              </div>

              {/* 3 metric tiles (kanan) — identik dengan kartu dashboard */}
              <div className="flex flex-col gap-3">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-lg">
                  <p className="text-xs text-gray-400 mb-1">Total DP</p>
                  <p className="text-xl font-medium text-amber-700">
                    {flow.totalAmount > 0 ? formatCurrency(flow.totalAmount) : "Belum dipilih"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Akumulasi layanan</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                  <p className="text-xs text-gray-400 mb-1">Durasi</p>
                  <p className="text-xl font-medium text-gray-900">{flow.totalDuration || defaultDuration} menit</p>
                  <p className="text-xs text-gray-400 mt-1">Estimasi booking</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                  <p className="text-xs text-gray-400 mb-1">Resource</p>
                  <p className="text-base font-medium text-gray-900 truncate">{flow.resource?.name || "Pilih resource"}</p>
                  <p className="text-xs text-gray-400 mt-1">{filteredResources.length} opsi tersedia</p>
                </div>
              </div>
            </div>

            {/* ── Error bar ── */}
            {error ? (
              <div className="mb-5">
                <ErrorState description={error} retry={() => void loadStore()} />
              </div>
            ) : null}

            {/* ── Body: form kiri + summary kanan ── */}
            <div className="grid grid-cols-3 gap-3">

              {/* Kiri: form steps — col-span-2 */}
              <div className="col-span-2 space-y-3">

                {/* Step 1: Tanggal */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">1. PILIH TANGGAL</p>
                  <p className="text-xs text-gray-400 mb-4">Atur tanggal booking dan lanjut ke pemilihan resource.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => { flow.setDate(shiftDate(flow.date || todayInJakarta(), -1)); setStep(0); }}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      ← Sebelumnya
                    </button>
                    <input
                      type="date"
                      value={flow.date}
                      onChange={(e) => { flow.setDate(e.target.value); setStep(0); }}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors"
                    />
                    <button
                      onClick={() => { flow.setDate(shiftDate(flow.date || todayInJakarta(), 1)); setStep(0); }}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Berikutnya →
                    </button>
                    <button
                      onClick={() => { flow.setDate(todayInJakarta()); setStep(0); }}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      Hari ini
                    </button>
                  </div>
                </div>

                {/* Step 2: Resource */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">2. PILIH RESOURCE</p>
                  <p className="text-xs text-gray-400 mb-4">Tampilan resource dibuat seperti kartu pilihan di dashboard.</p>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-gray-500">Jumlah orang</span>
                    <input
                      type="number"
                      min={1}
                      value={flow.pax}
                      onChange={(e) => flow.setPax(Number(e.target.value) || 1)}
                      className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  {filteredResources.length === 0 ? (
                    <EmptyState
                      title="Tidak ada resource yang cocok"
                      description="Kurangi jumlah pax atau cek resource aktif di dashboard booking."
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                      {filteredResources.map((resource) => {
                        const active = flow.resourceId === resource.id;
                        return (
                          <button
                            key={resource.id}
                            onClick={() => { flow.setResourceId(resource.id); setStep(Math.max(step, 1)); }}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              active
                                ? "border-amber-200 bg-amber-50 shadow-lg"
                                : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-xs font-medium text-gray-900">{resource.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                active ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-500"
                              }`}>
                                {active ? "Dipilih" : "Tersedia"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mb-2">
                              {RESOURCE_TYPE_LABEL[resource.type]}{resource.capacity ? ` · ${resource.capacity} orang` : ""}
                            </p>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                              {resource.description || "Resource siap dipakai untuk booking customer."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 3: Slot & Layanan */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">3. PILIH SLOT & LAYANAN</p>
                  <p className="text-xs text-gray-400 mb-4">Slot refresh otomatis saat resource, pax, atau layanan berubah.</p>

                  {/* Slot grid */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-800">Slot tersedia</p>
                      <span className="text-[10px] text-gray-400">{flow.resource?.name || "Belum pilih resource"}</span>
                    </div>
                    {loadingSlots ? (
                      <LoadingState label="Memuat slot..." />
                    ) : slots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-xs text-gray-400">
                        Belum ada slot untuk kombinasi pilihan saat ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 xl:grid-cols-5">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => { flow.setSlot(slot.time); setStep(Math.max(step, 2)); }}
                            className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                              flow.slot === slot.time
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : slot.available
                                  ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                  : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                            }`}
                          >
                            <div>{formatTimeLabel(slot.time)}</div>
                            {!slot.available && slot.reason ? (
                              <div className="mt-0.5 text-[10px] opacity-70">{slot.reason}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Produk/layanan */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-800">Layanan booking</p>
                      <span className="text-[10px] text-gray-400">{flow.selectedProducts.length} layanan dipilih</span>
                    </div>
                    {flow.store.products.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-xs text-gray-400">
                        Belum ada layanan booking aktif.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {flow.store.products.map((product) => {
                          const selected = flow.selectedProducts.find((item) => item.id === product.id);
                          return (
                            <div
                              key={product.id}
                              className={`rounded-xl border p-4 transition-colors ${
                                selected ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{product.name}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {formatCurrency(product.price)} · {product.bookingDurationMin || defaultDuration} menit
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => flow.toggleProduct(product.id)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                                      selected
                                        ? "bg-amber-700 text-white hover:bg-amber-800"
                                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    {selected ? "Dipilih" : "Pilih"}
                                  </button>
                                  {selected ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={selected.qty}
                                      onChange={(e) => flow.setProductQty(product.id, Number(e.target.value) || 1)}
                                      className="w-16 rounded-xl border border-gray-200 px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors"
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4: Data Customer */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-lg">
                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">4. DATA CUSTOMER</p>
                  <p className="text-xs text-gray-400 mb-4">Isi data singkat customer untuk menyelesaikan reservasi.</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1.5 block">Nama</span>
                      <input
                        value={flow.customerName}
                        onChange={(e) => { flow.setCustomerField("customerName", e.target.value); setStep(Math.max(step, 3)); }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors"
                        placeholder="Nama lengkap"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1.5 block">WhatsApp</span>
                      <input
                        value={flow.customerPhone}
                        onChange={(e) => { flow.setCustomerField("customerPhone", e.target.value); setStep(Math.max(step, 3)); }}
                        onBlur={(e) => flow.setCustomerField("customerPhone", normalizePhone(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors"
                        placeholder="62812xxxxxxx"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600 mb-1.5 block">Catatan</span>
                    <textarea
                      rows={3}
                      value={flow.customerNote}
                      onChange={(e) => flow.setCustomerField("customerNote", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-900 outline-none focus:border-amber-400 transition-colors resize-none"
                      placeholder="Opsional, misalnya request area tertentu atau kebutuhan khusus."
                    />
                  </label>
                </div>

              </div>

              {/* Kanan: Summary sticky — identik dengan panel kanan dashboard */}
              <div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg sticky top-5">

                  <p className="text-xs font-medium text-gray-400 tracking-wider mb-1">RINGKASAN BOOKING</p>
                  <p className="text-xs text-gray-400 mb-4">Periksa kembali detail sebelum lanjut ke pembayaran.</p>

                  <div className="space-y-2 mb-4">
                    <SummaryRow label="Tanggal" value={flow.date ? formatDateLabel(flow.date) : "-"} />
                    <SummaryRow label="Slot" value={flow.slot ? formatTimeLabel(flow.slot) : "-"} />
                    <SummaryRow label="Resource" value={flow.resource?.name || "-"} />
                    <SummaryRow label="Pax" value={String(flow.pax)} />
                  </div>

                  {/* Progress — sama persis gaya dashboard */}
                  <div className="bg-gray-100 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 tracking-wider uppercase">Status Progress</p>
                        <p className="text-xs font-medium text-gray-900 mt-0.5">
                          {canContinue.filter(Boolean).length}/{canContinue.length} langkah siap
                        </p>
                      </div>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-amber-600 transition-all"
                          style={{ width: `${(canContinue.filter(Boolean).length / canContinue.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Item list */}
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-800">Item dipilih</p>
                      <span className="text-[10px] text-gray-400">{flow.selectedProducts.length} item</span>
                    </div>
                    {flow.selectedProducts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-400 text-center">
                        Belum ada layanan dipilih.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {flow.selectedProducts.map((item) => (
                          <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-medium text-gray-900">{item.name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{item.qty} x {formatCurrency(item.price)}</p>
                              </div>
                              <p className="text-xs font-medium text-amber-700 flex-shrink-0">{formatCurrency(item.price * item.qty)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total box — sama dengan card "Keuntungan Bersih" di dashboard */}
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                    <p className="text-[10px] font-medium text-amber-700 tracking-widest uppercase mb-1">Total DP</p>
                    <p className="text-2xl font-medium text-gray-900">{formatCurrency(flow.totalAmount)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Pembayaran diproses via Midtrans</p>
                  </div>

                  {/* CTA — sama persis dengan tombol "Buka Kasir" di dashboard */}
                  <button
                    disabled={!canContinue.every(Boolean) || submitting}
                    onClick={() => { setStep(4); void handleSubmit(); }}
                    className="w-full bg-amber-700 text-white rounded-xl px-4 py-3 text-xs font-medium hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Menyiapkan pembayaran..." : "Lanjut ke pembayaran"}
                  </button>

                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ── Komponen kecil ── identik gaya dashboard ──────────────────────────────────

function TopPill({ label }: { label: string }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
      {label}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}