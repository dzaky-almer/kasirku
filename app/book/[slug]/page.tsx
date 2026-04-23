"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const loadStore = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const store = await bookingApi.getPublicStore(slug);
      flow.setStore(store);
      if (!flow.date) {
        flow.setDate(todayInJakarta());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat halaman booking.");
    } finally {
      setLoading(false);
    }
  }, [flow, slug]);

  useEffect(() => {
    if (!slug) return;
    void loadStore();
  }, [loadStore, slug]);

  useEffect(() => {
    if (!flow.store?.id) return;
    bookingApi
      .getMidtransConfig(flow.store.id)
      .then((result) => setMidtrans(result))
      .catch(() => null);
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
  }, [flow.date, flow.pax, flow.resourceId, flow.store, flow.totalDuration, slug]);

  const filteredResources = useMemo(() => {
    if (!flow.store) return [];

    return flow.store.bookingResources.filter((resource) => {
      if (resource.type === "BARBER" || !resource.capacity) return true;
      return resource.capacity >= flow.pax;
    });
  }, [flow.pax, flow.store]);

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
        items: flow.selectedProducts.map((item) => ({
          productId: item.id,
          qty: item.qty,
        })),
      });

      const payment = await bookingApi.createMidtransTransaction({
        bookingId: created.booking.id,
        orderId: created.payment.orderId,
        total: created.payment.grossAmount,
        storeId: flow.store.id,
        itemDetails: flow.selectedProducts.map((item) => ({
          id: item.id,
          price: item.price,
          quantity: item.qty,
          name: item.name,
        })),
        customer: {
          first_name: flow.customerName.trim(),
          phone,
        },
      });

      setMidtrans({
        clientKey: payment.clientKey,
        isProduction: payment.isProduction,
      });

      if (!window.snap) {
        throw new Error("Widget pembayaran belum siap. Coba ulang beberapa detik lagi.");
      }

      window.snap.pay(payment.token, {
        onSuccess: async () => {
          await bookingApi.confirmPublicBooking(slug, created.booking.id);
          flow.resetSelectionAfterBooking();
          router.push(`/book/${slug}/success?id=${created.booking.id}`);
        },
        onPending: () => {
          router.push(`/book/${slug}/success?id=${created.booking.id}&status=pending`);
        },
        onError: () => {
          setError("Pembayaran gagal. Silakan coba lagi.");
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_38%,_#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <LoadingState label="Memuat halaman booking..." />
        </div>
      </div>
    );
  }

  if (!flow.store) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_38%,_#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <ErrorState description={error || "Store booking tidak ditemukan."} retry={() => void loadStore()} />
        </div>
      </div>
    );
  }

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
                  Pilih tanggal, resource, dan layanan. Setelah itu DP dibayar via Midtrans untuk mengunci reservasi.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5">{flow.store.type}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5">{flow.store.slug}</span>
                  {flow.store.waNumber ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">{flow.store.waNumber}</span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <BookingStepper currentStep={step} steps={STEPS} />
                <p className="mt-4 text-sm text-slate-500">
                  {formatDateLabel(flow.date || todayInJakarta(), {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {flow.totalAmount > 0 ? formatCurrency(flow.totalAmount) : "Pilih layanan dulu"}
                </p>
                <p className="mt-1 text-sm text-slate-500">Total durasi estimasi {flow.totalDuration || defaultDuration} menit</p>
              </div>
            </div>
          </header>

          {error ? <ErrorState description={error} retry={() => void loadStore()} /> : null}

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <SectionCard title="1. Pilih Tanggal" description="Cek slot yang masih tersedia secara real time.">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      flow.setDate(shiftDate(flow.date || todayInJakarta(), -1));
                      setStep(0);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Hari sebelumnya
                  </button>
                  <input
                    type="date"
                    value={flow.date}
                    onChange={(event) => {
                      flow.setDate(event.target.value);
                      setStep(0);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                  <button
                    onClick={() => {
                      flow.setDate(shiftDate(flow.date || todayInJakarta(), 1));
                      setStep(0);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Hari berikutnya
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="2. Pilih Resource"
                description="Resource dengan kapasitas kurang dari jumlah pax otomatis tidak ditampilkan."
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-sm text-slate-500">Jumlah orang</span>
                  <input
                    type="number"
                    min={1}
                    value={flow.pax}
                    onChange={(event) => flow.setPax(Number(event.target.value) || 1)}
                    className="w-24 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>

                {filteredResources.length === 0 ? (
                  <EmptyState
                    title="Tidak ada resource yang cocok"
                    description="Kurangi jumlah pax atau hubungi toko untuk bantuan booking."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredResources.map((resource) => {
                      const active = flow.resourceId === resource.id;
                      return (
                        <button
                          key={resource.id}
                          onClick={() => {
                            flow.setResourceId(resource.id);
                            setStep(Math.max(step, 1));
                          }}
                          className={`rounded-3xl border p-5 text-left transition ${
                            active ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <p className="text-sm font-semibold">{resource.name}</p>
                          <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                            {RESOURCE_TYPE_LABEL[resource.type]} {resource.capacity ? `• ${resource.capacity} orang` : ""}
                          </p>
                          <p className={`mt-3 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>
                            {resource.description || "Tanpa deskripsi tambahan."}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="3. Pilih Slot & Layanan" description="Slot akan refresh saat pilihan berubah.">
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Slot tersedia</p>
                    {loadingSlots ? (
                      <div className="mt-3">
                        <LoadingState label="Memuat slot..." />
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">Belum ada slot untuk kombinasi pilihan saat ini.</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => {
                              flow.setSlot(slot.time);
                              setStep(Math.max(step, 1));
                            }}
                            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                              flow.slot === slot.time
                                ? "border-slate-900 bg-slate-950 text-white"
                                : slot.available
                                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            }`}
                          >
                            <div>{formatTimeLabel(slot.time)}</div>
                            {!slot.available && slot.reason ? (
                              <div className="mt-1 text-[11px] opacity-80">{slot.reason}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700">Layanan / produk booking</p>
                    {flow.store.products.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">Belum ada layanan booking aktif.</p>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {flow.store.products.map((product) => {
                          const selected = flow.selectedProducts.find((item) => item.id === product.id);
                          return (
                            <div
                              key={product.id}
                              className={`rounded-3xl border p-4 transition ${
                                selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">{product.name}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatCurrency(product.price)} • {product.bookingDurationMin || defaultDuration} menit
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => flow.toggleProduct(product.id)}
                                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                                      selected
                                        ? "bg-slate-950 text-white"
                                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    {selected ? "Dipilih" : "Pilih"}
                                  </button>
                                  {selected ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={selected.qty}
                                      onChange={(event) => flow.setProductQty(product.id, Number(event.target.value) || 1)}
                                      className="w-20 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
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
              </SectionCard>

              <SectionCard title="4. Data Customer" description="Nomor WhatsApp akan dinormalisasi ke format 62.">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Nama</span>
                    <input
                      value={flow.customerName}
                      onChange={(event) => {
                        flow.setCustomerField("customerName", event.target.value);
                        setStep(Math.max(step, 3));
                      }}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="Nama lengkap"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">WhatsApp</span>
                    <input
                      value={flow.customerPhone}
                      onChange={(event) => {
                        flow.setCustomerField("customerPhone", event.target.value);
                        setStep(Math.max(step, 3));
                      }}
                      onBlur={(event) => flow.setCustomerField("customerPhone", normalizePhone(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="62812xxxxxxx"
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Catatan</span>
                  <textarea
                    rows={4}
                    value={flow.customerNote}
                    onChange={(event) => flow.setCustomerField("customerNote", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="Opsional, misalnya request kursi dekat jendela."
                  />
                </label>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Ringkasan Booking" description="Periksa lagi sebelum lanjut ke pembayaran.">
                <div className="space-y-4 text-sm">
                  <SummaryRow label="Tanggal" value={flow.date ? formatDateLabel(flow.date) : "-"} />
                  <SummaryRow label="Slot" value={flow.slot ? formatTimeLabel(flow.slot) : "-"} />
                  <SummaryRow label="Resource" value={flow.resource?.name || "-"} />
                  <SummaryRow label="Pax" value={String(flow.pax)} />
                </div>

                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold text-slate-900">Item dipilih</p>
                  {flow.selectedProducts.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">Belum ada layanan dipilih.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {flow.selectedProducts.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.qty} x {formatCurrency(item.price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.price * item.qty)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-3xl bg-slate-950 px-5 py-4 text-white">
                  <p className="text-sm text-slate-300">Total DP</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(flow.totalAmount)}</p>
                </div>

                <button
                  disabled={!canContinue.every(Boolean) || submitting}
                  onClick={() => {
                    setStep(4);
                    void handleSubmit();
                  }}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Menyiapkan pembayaran..." : "Lanjut ke pembayaran"}
                </button>
              </SectionCard>
            </div>
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
