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
  todayInJakarta,
} from "@/lib/booking/format";
import type { AvailabilitySlot } from "@/lib/booking/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionCard,
  StatusBadge,
} from "@/components/booking/ui";
import { BookingStepper } from "@/components/booking/public/booking-stepper";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

const STEPS = ["Tanggal", "Slot", "Produk", "Customer", "Konfirmasi"];

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
      const config = await bookingApi.getMidtransConfig(store.id);
      setMidtrans(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat halaman booking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStore();
  }, [slug]);

  useEffect(() => {
    if (!flow.store || !flow.resourceId || !flow.date) return;

    let active = true;

    async function loadAvailability() {
      setLoadingSlots(true);

      try {
        const params = new URLSearchParams({
          date: flow.date,
          resourceId: flow.resourceId,
          pax: String(flow.pax),
        });

        if (flow.totalDuration > 0) {
          params.set("durationMinutes", String(flow.totalDuration));
        }

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

    return () => {
      active = false;
    };
  }, [flow.date, flow.pax, flow.resourceId, flow.totalDuration, flow.store, slug]);

  const availableResources = useMemo(() => {
    return (
      flow.store?.bookingResources.filter((resource) =>
        resource.capacity ? resource.capacity >= flow.pax : true
      ) ?? []
    );
  }, [flow.pax, flow.store?.bookingResources]);

  const selectedResource = availableResources.find((resource) => resource.id === flow.resourceId) ?? flow.resource;

  async function handleSubmit() {
    if (!flow.store || !selectedResource) return;

    setSubmitting(true);
    setError("");

    try {
      const phone = normalizePhone(flow.customerPhone);
      const booking = await bookingApi.createPublicBooking(slug, {
        bookingDate: flow.date,
        startTime: flow.slot,
        resourceId: selectedResource.id,
        pax: flow.pax,
        customerName: flow.customerName,
        customerPhone: phone,
        customerNote: flow.customerNote,
        items: flow.selectedProducts.map((item) => ({ productId: item.id, qty: item.qty })),
      });

      const payment = await bookingApi.createMidtransTransaction({
        bookingId: booking.booking.id,
        orderId: booking.payment.orderId,
        total: booking.payment.grossAmount,
        storeId: flow.store.id,
        itemDetails: flow.selectedProducts.map((item) => ({
          id: item.id,
          price: item.price,
          quantity: item.qty,
          name: item.name,
        })),
        customer: {
          first_name: flow.customerName,
          phone,
        },
      });

      if (!window.snap) {
        throw new Error("Midtrans Snap belum siap. Coba refresh halaman lalu ulangi pembayaran.");
      }

      window.snap.pay(payment.token, {
        onSuccess: async () => {
          await bookingApi.confirmPublicBooking(slug, booking.booking.id);
          flow.resetSelectionAfterBooking();
          router.push(`/book/${slug}/success?id=${booking.booking.id}`);
        },
        onPending: () => {
          router.push(`/book/${slug}/success?id=${booking.booking.id}&status=pending`);
        },
        onError: () => {
          setError("Pembayaran gagal diproses. Silakan coba lagi.");
          setSubmitting(false);
        },
        onClose: () => {
          setSubmitting(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat booking.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <LoadingState label="Memuat halaman booking..." />
        </div>
      </div>
    );
  }

  if (!flow.store) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <ErrorState description={error || "Store booking tidak ditemukan."} retry={() => void loadStore()} />
        </div>
      </div>
    );
  }

  const canContinue = [
    Boolean(flow.date),
    Boolean(flow.slot && selectedResource),
    flow.selectedProducts.length > 0,
    Boolean(flow.customerName.trim() && flow.customerPhone.trim()),
    true,
  ];

  return (
    <>
      {midtrans ? (
        <Script
          src={`${midtrans.isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"}/snap/snap.js`}
          data-client-key={midtrans.clientKey}
          strategy="afterInteractive"
        />
      ) : null}

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_38%,_#f8fafc)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-medium text-sky-700">Online Booking</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{flow.store.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Pilih tanggal, cek slot real-time, lalu selesaikan pembayaran DP untuk mengunci reservasi.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {flow.store.type}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {flow.store.bookingOpenTime} - {flow.store.bookingCloseTime}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    Interval {flow.store.bookingSlotMinutes} menit
                  </span>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-950">Ringkasan Booking</p>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryRow label="Tanggal" value={flow.date ? formatDateLabel(flow.date, { day: "numeric", month: "short", year: "numeric" }) : "-"} />
                  <SummaryRow label="Slot" value={flow.slot ? formatTimeLabel(flow.slot) : "-"} />
                  <SummaryRow label="Resource" value={selectedResource?.name || "-"} />
                  <SummaryRow label="Produk" value={flow.selectedProducts.length ? `${flow.selectedProducts.length} item` : "-"} />
                  <SummaryRow label="Total DP" value={formatCurrency(flow.totalAmount)} />
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <SectionCard title="Progress Booking" description="Alur dibuat singkat supaya customer bisa selesai dalam beberapa klik.">
                <BookingStepper currentStep={step} steps={STEPS} />
              </SectionCard>

              {error ? <ErrorState description={error} retry={() => void loadStore()} /> : null}

              {step === 0 ? (
                <SectionCard title="Step 1. Pilih Tanggal" description="Tanggal dipakai untuk mengambil slot real-time sesuai timezone Asia/Jakarta.">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Tanggal booking</span>
                      <input
                        type="date"
                        value={flow.date}
                        min={todayInJakarta()}
                        onChange={(event) => flow.setDate(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      />
                    </label>
                    <button
                      onClick={() => flow.setDate(todayInJakarta())}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Hari ini
                    </button>
                    <button
                      disabled={!canContinue[0]}
                      onClick={() => setStep(1)}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Lanjut pilih slot
                    </button>
                  </div>
                </SectionCard>
              ) : null}

              {step === 1 ? (
                <SectionCard title="Step 2. Pilih Resource & Slot" description="Availability selalu mengambil data terbaru dari backend.">
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      {availableResources.map((resource) => {
                        const active = resource.id === selectedResource?.id;
                        return (
                          <button
                            key={resource.id}
                            onClick={() => flow.setResourceId(resource.id)}
                            className={`rounded-3xl border p-4 text-left transition ${
                              active
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                            }`}
                          >
                            <p className="text-base font-semibold">{resource.name}</p>
                            <p className={`mt-1 text-sm ${active ? "text-slate-300" : "text-slate-500"}`}>
                              {resource.type} {resource.capacity ? `· ${resource.capacity} pax` : ""}
                            </p>
                            <p className={`mt-2 text-xs ${active ? "text-slate-400" : "text-slate-400"}`}>
                              {resource.description || "Tidak ada deskripsi tambahan."}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <label className="block max-w-xs">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Jumlah orang</span>
                      <input
                        type="number"
                        min={1}
                        value={flow.pax}
                        onChange={(event) => flow.setPax(Number(event.target.value) || 1)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      />
                    </label>

                    {loadingSlots ? (
                      <LoadingState label="Mengecek slot tersedia..." />
                    ) : slots.length === 0 ? (
                      <EmptyState
                        title="Belum ada slot tersedia"
                        description="Coba pilih resource lain, ubah tanggal, atau kurangi jumlah orang."
                      />
                    ) : (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => flow.setSlot(slot.time)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                              !slot.available
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : flow.slot === slot.time
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            }`}
                          >
                            {formatTimeLabel(slot.time)}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-between gap-3">
                      <button
                        onClick={() => setStep(0)}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Kembali
                      </button>
                      <button
                        disabled={!canContinue[1]}
                        onClick={() => setStep(2)}
                        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        Lanjut pilih produk
                      </button>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {step === 2 ? (
                <SectionCard title="Step 3. Pilih Produk / Layanan" description="Minimal pilih satu produk booking agar nominal DP dan durasi bisa dihitung dari backend.">
                  {flow.store.products.length === 0 ? (
                    <EmptyState
                      title="Belum ada produk booking"
                      description="Store ini belum mengaktifkan produk untuk booking online."
                    />
                  ) : (
                    <div className="space-y-4">
                      {flow.store.products.map((product) => {
                        const selected = flow.selectedProducts.find((item) => item.id === product.id);

                        return (
                          <div
                            key={product.id}
                            className={`rounded-3xl border p-5 transition ${
                              selected ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold text-slate-950">{product.name}</p>
                                  {product.category ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                      {product.category}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                  {formatCurrency(product.price)} · Durasi {product.bookingDurationMin ?? flow.store.bookingSlotMinutes} menit
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                {selected ? (
                                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                                    <button
                                      onClick={() => flow.setProductQty(product.id, selected.qty - 1)}
                                      className="h-7 w-7 rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                                    >
                                      -
                                    </button>
                                    <span className="min-w-6 text-center text-sm font-semibold text-slate-900">{selected.qty}</span>
                                    <button
                                      onClick={() => flow.setProductQty(product.id, selected.qty + 1)}
                                      className="h-7 w-7 rounded-full bg-slate-950 text-sm font-semibold text-white"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : null}
                                <button
                                  onClick={() => flow.toggleProduct(product.id)}
                                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                                    selected
                                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                      : "bg-slate-950 text-white hover:bg-slate-800"
                                  }`}
                                >
                                  {selected ? "Batalkan" : "Pilih"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap justify-between gap-3">
                        <button
                          onClick={() => setStep(1)}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Kembali
                        </button>
                        <button
                          disabled={!canContinue[2]}
                          onClick={() => setStep(3)}
                          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          Lanjut isi data customer
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>
              ) : null}

              {step === 3 ? (
                <SectionCard title="Step 4. Data Customer" description="Nomor WhatsApp dipakai untuk validasi booking dan follow up operasional.">
                  <div className="grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Nama customer</span>
                      <input
                        value={flow.customerName}
                        onChange={(event) => flow.setCustomerField("customerName", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder="Nama lengkap"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Nomor WhatsApp</span>
                      <input
                        value={flow.customerPhone}
                        onChange={(event) => flow.setCustomerField("customerPhone", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder="0812xxxx atau 62812xxxx"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Catatan</span>
                      <textarea
                        rows={4}
                        value={flow.customerNote}
                        onChange={(event) => flow.setCustomerField("customerNote", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder="Opsional, misalnya request area tertentu atau kebutuhan khusus."
                      />
                    </label>

                    <div className="flex flex-wrap justify-between gap-3">
                      <button
                        onClick={() => setStep(2)}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Kembali
                      </button>
                      <button
                        disabled={!canContinue[3]}
                        onClick={() => setStep(4)}
                        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        Review booking
                      </button>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {step === 4 ? (
                <SectionCard title="Step 5. Konfirmasi & Pembayaran" description="Setelah review, DP akan dibayar via Midtrans Snap untuk mengunci booking.">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PreviewItem label="Tanggal" value={formatDateLabel(flow.date)} />
                      <PreviewItem label="Jam" value={formatTimeLabel(flow.slot)} />
                      <PreviewItem label="Resource" value={selectedResource?.name || "-"} />
                      <PreviewItem label="Jumlah orang" value={`${flow.pax} orang`} />
                      <PreviewItem label="Customer" value={flow.customerName} />
                      <PreviewItem label="WhatsApp" value={normalizePhone(flow.customerPhone)} />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-950">Produk terpilih</p>
                        <StatusBadge status="PAID" type="payment" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {flow.selectedProducts.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">
                              {item.name} x {item.qty}
                            </span>
                            <span className="font-medium text-slate-950">{formatCurrency(item.price * item.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4 text-base font-semibold text-slate-950">
                        Total DP {formatCurrency(flow.totalAmount)}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-3">
                      <button
                        onClick={() => setStep(3)}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Kembali
                      </button>
                      <button
                        disabled={submitting}
                        onClick={() => void handleSubmit()}
                        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {submitting ? "Memproses..." : "Bayar DP & konfirmasi"}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              ) : null}
            </div>

            <aside className="space-y-6">
              <SectionCard title="Info Store" description="Semua informasi diambil dari endpoint public booking store.">
                <div className="space-y-3 text-sm text-slate-600">
                  <SummaryRow label="Alamat" value={flow.store.address || "-"} />
                  <SummaryRow label="WhatsApp store" value={flow.store.waNumber || "-"} />
                  <SummaryRow label="Grace period" value={`${flow.store.bookingGraceMinutes ?? 0} menit`} />
                </div>
              </SectionCard>

              <SectionCard title="Kenapa slot bisa berubah?" description="Slot mengikuti resource, pax, dan total durasi produk yang dipilih.">
                <ul className="space-y-3 text-sm text-slate-500">
                  <li>Slot yang sudah lewat otomatis ditutup.</li>
                  <li>Slot bentrok dengan booking lain akan ditandai tidak tersedia.</li>
                  <li>Mengubah produk dapat mempengaruhi durasi dan ketersediaan slot.</li>
                </ul>
              </SectionCard>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
