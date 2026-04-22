"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────
interface BookingProduct {
    id: string;
    name: string;
    price: number;
    category: string | null;
    bookingDurationMin: number | null;
}
interface BookingResource {
    id: string;
    type: "BARBER" | "TABLE" | "AREA" | "ROOM";
    name: string;
    capacity: number | null;
    description: string | null;
    products: BookingProduct[];
}
interface StoreInfo {
    id: string;
    name: string;
    slug: string;
    type: string;
    address: string | null;
    waNumber: string | null;
    bookingOpenTime: string;
    bookingCloseTime: string;
    bookingSlotMinutes: number;
    bookingResources: BookingResource[];
}
interface SlotInfo {
    time: string;
    available: boolean;
    reason?: string;
}

// ── Helpers ────────────────────────────────────────────────────
function fmtPrice(n: number) {
    return "Rp " + n.toLocaleString("id-ID");
}
function resourceIcon(type: string) {
    switch (type) {
        case "BARBER": return "💈";
        case "TABLE": return "🍽️";
        case "AREA": return "🏠";
        case "ROOM": return "🚪";
        default: return "📍";
    }
}
function resourceLabel(type: string) {
    switch (type) {
        case "BARBER": return "Kursi";
        case "TABLE": return "Meja";
        case "AREA": return "Area";
        case "ROOM": return "Ruangan";
        default: return "Aset";
    }
}
function storeTypeIcon(type: string) {
    const t = type?.toLowerCase();
    if (t?.includes("barber")) return "💈";
    if (t?.includes("cafe") || t?.includes("kafe") || t?.includes("resto")) return "☕";
    if (t?.includes("salon")) return "💇";
    if (t?.includes("gym") || t?.includes("fitness")) return "🏋️";
    if (t?.includes("hotel") || t?.includes("villa")) return "🏨";
    return "🏪";
}

// ── Step indicator ─────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
    const steps = ["Tanggal & Aset", "Pilih Layanan", "Data Diri", "Konfirmasi"];
    return (
        <div className="flex items-center gap-0 mb-8">
            {steps.map((s, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${i < step ? "bg-emerald-500 text-white" :
                                i === step ? "bg-gray-900 text-white ring-4 ring-gray-900/20" :
                                    "bg-gray-100 text-gray-400"
                            }`}>
                            {i < step ? "✓" : i + 1}
                        </div>
                        <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${i === step ? "text-gray-900" : "text-gray-400"}`}>{s}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all duration-500 ${i < step ? "bg-emerald-500" : "bg-gray-100"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function BookingPage() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();

    // Store data
    const [store, setStore] = useState<StoreInfo | null>(null);
    const [loadingStore, setLoadingStore] = useState(true);
    const [storeError, setStoreError] = useState("");

    // Step state
    const [step, setStep] = useState(0);

    // Step 0: date + resource
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedResource, setSelectedResource] = useState<BookingResource | null>(null);
    const [pax, setPax] = useState(1);

    // Step 1: time + products
    const [slots, setSlots] = useState<SlotInfo[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedTime, setSelectedTime] = useState("");
    const [selectedItems, setSelectedItems] = useState<{ productId: string; qty: number; product: BookingProduct }[]>([]);

    // Step 2: customer data
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerNote, setCustomerNote] = useState("");

    // Step 3: submitting
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    // Min date = today
    const today = new Date().toISOString().split("T")[0];

    // Fetch store
    useEffect(() => {
        async function load() {
            setLoadingStore(true);
            try {
                const res = await fetch(`/api/book/${slug}`);
                if (!res.ok) throw new Error("Toko tidak ditemukan");
                const data = await res.json();
                setStore(data);
                setSelectedDate(today);
            } catch (e: any) {
                setStoreError(e.message || "Gagal memuat data toko");
            } finally {
                setLoadingStore(false);
            }
        }
        if (slug) load();
    }, [slug]);

    // Fetch slots when resource/date/pax changes (step 1)
    const fetchSlots = useCallback(async () => {
        if (!selectedResource || !selectedDate) return;
        setLoadingSlots(true);
        setSlots([]);
        setSelectedTime("");
        try {
            const totalDur = selectedItems.reduce((s, it) => s + (it.product.bookingDurationMin ?? 30) * it.qty, 0);
            const params = new URLSearchParams({
                date: selectedDate,
                resourceId: selectedResource.id,
                pax: String(pax),
                ...(totalDur > 0 ? { durationMinutes: String(totalDur) } : {}),
            });
            const res = await fetch(`/api/book/${slug}/availability?${params}`);
            const data = await res.json();
            setSlots(data.slots ?? []);
        } catch {
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [selectedResource, selectedDate, pax, selectedItems, slug]);

    useEffect(() => {
        if (step === 1) fetchSlots();
    }, [step, fetchSlots]);

    // Cart helpers
    function toggleItem(product: BookingProduct) {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.productId === product.id);
            if (exists) return prev.filter(i => i.productId !== product.id);
            return [...prev, { productId: product.id, qty: 1, product }];
        });
    }
    function changeQty(productId: string, delta: number) {
        setSelectedItems(prev =>
            prev.map(i => i.productId === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
        );
    }

    const totalDP = selectedItems.reduce((s, i) => s + i.product.price * i.qty, 0);
    const totalDuration = selectedItems.reduce((s, i) => s + (i.product.bookingDurationMin ?? 30) * i.qty, 0);

    // Filter resources by capacity
    const availableResources = store?.bookingResources.filter(r => {
        if (r.type !== "TABLE" && r.type !== "AREA" && r.type !== "ROOM") return true;
        if (!r.capacity) return true;
        return r.capacity >= pax;
    }) ?? [];

    // Submit booking
    async function handleSubmit() {
        setSubmitting(true);
        setSubmitError("");
        try {
            const res = await fetch(`/api/book/${slug}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName,
                    customerPhone,
                    customerNote,
                    bookingDate: selectedDate,
                    startTime: selectedTime,
                    resourceId: selectedResource!.id,
                    pax,
                    items: selectedItems.map(i => ({ productId: i.productId, qty: i.qty })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Gagal membuat booking");

            // If there's payment, redirect to Midtrans Snap
            if (data.payment?.snapToken) {
                // @ts-ignore
                window.snap?.pay(data.payment.snapToken, {
                    onSuccess: async () => {
                        await fetch(`/api/book/${slug}/confirm`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ bookingId: data.booking.id }),
                        });
                        router.push(`/book/${slug}/success?id=${data.booking.id}`);
                    },
                    onPending: () => router.push(`/book/${slug}/success?id=${data.booking.id}&status=pending`),
                    onError: () => setSubmitError("Pembayaran gagal. Silakan coba lagi."),
                    onClose: () => setSubmitting(false),
                });
            } else {
                router.push(`/book/${slug}/success?id=${data.booking.id}`);
            }
        } catch (e: any) {
            setSubmitError(e.message || "Terjadi kesalahan");
            setSubmitting(false);
        }
    }

    // ── Loading / Error states ─────────────────────────────────
    if (loadingStore) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Memuat halaman booking...</p>
                </div>
            </div>
        );
    }
    if (storeError || !store) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-4xl mb-3">🔍</p>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Halaman tidak ditemukan</h2>
                    <p className="text-sm text-gray-500">{storeError || "Link booking tidak valid."}</p>
                </div>
            </div>
        );
    }

    const needsPax = selectedResource && ["TABLE", "AREA", "ROOM"].includes(selectedResource.type);
    const products = selectedResource?.products ?? store.bookingResources.flatMap(r => r.products);
    const uniqueProducts = products.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

    return (
        <>
            {/* Midtrans snap script */}
            <script src="https://app.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} async />

            <div className="min-h-screen bg-gray-50">
                {/* Store header */}
                <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
                    <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-xl flex-shrink-0">
                            {storeTypeIcon(store.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-bold text-gray-900 truncate">{store.name}</h1>
                            <p className="text-[11px] text-gray-400 truncate">{store.address ?? store.type}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-gray-400">Jam Buka</p>
                            <p className="text-xs font-semibold text-gray-700">{store.bookingOpenTime} – {store.bookingCloseTime}</p>
                        </div>
                    </div>
                </div>

                <div className="max-w-lg mx-auto px-4 py-6">
                    <StepBar step={step} />

                    {/* ── STEP 0: Date & Resource ── */}
                    {step === 0 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Pilih Tanggal</h2>
                                <p className="text-xs text-gray-400 mb-3">Tentukan kapan kamu ingin datang</p>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    min={today}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 bg-white"
                                />
                            </div>

                            {/* Pax input — only if there are TABLE/AREA/ROOM resources */}
                            {store.bookingResources.some(r => ["TABLE", "AREA", "ROOM"].includes(r.type)) && (
                                <div>
                                    <h2 className="text-base font-bold text-gray-900 mb-1">Jumlah Orang</h2>
                                    <p className="text-xs text-gray-400 mb-3">Berapa orang yang akan datang?</p>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setPax(p => Math.max(1, p - 1))}
                                            className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors text-lg font-light">−</button>
                                        <span className="text-xl font-bold text-gray-900 w-8 text-center">{pax}</span>
                                        <button onClick={() => setPax(p => p + 1)}
                                            className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors text-lg font-light">+</button>
                                        <span className="text-sm text-gray-500 ml-1">orang</span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Pilih {resourceLabel(store.bookingResources[0]?.type ?? "BARBER")}</h2>
                                <p className="text-xs text-gray-400 mb-3">{availableResources.length} tersedia untuk tanggal ini</p>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {store.bookingResources.map(r => {
                                        const isDisabled = ["TABLE", "AREA", "ROOM"].includes(r.type) && r.capacity !== null && r.capacity < pax;
                                        const isSelected = selectedResource?.id === r.id;
                                        return (
                                            <button
                                                key={r.id}
                                                disabled={isDisabled}
                                                onClick={() => setSelectedResource(isSelected ? null : r)}
                                                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isDisabled ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed" :
                                                        isSelected ? "border-gray-900 bg-gray-900 text-white" :
                                                            "border-gray-200 bg-white hover:border-gray-400"
                                                    }`}
                                            >
                                                <span className="text-2xl block mb-2">{resourceIcon(r.type)}</span>
                                                <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}>{r.name}</p>
                                                {r.capacity && (
                                                    <p className={`text-[10px] mt-0.5 ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                                                        Kapasitas {r.capacity} orang
                                                    </p>
                                                )}
                                                {r.description && (
                                                    <p className={`text-[10px] mt-0.5 truncate ${isSelected ? "text-gray-300" : "text-gray-400"}`}>{r.description}</p>
                                                )}
                                                {isDisabled && (
                                                    <span className="absolute top-2 right-2 text-[9px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-medium">Terlalu kecil</span>
                                                )}
                                                {isSelected && (
                                                    <span className="absolute top-2 right-2 text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-medium">✓</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                disabled={!selectedDate || !selectedResource}
                                onClick={() => setStep(1)}
                                className="w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Lanjut → Pilih Layanan
                            </button>
                        </div>
                    )}

                    {/* ── STEP 1: Time + Products ── */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-1">
                                ← Kembali
                            </button>

                            {/* Slot picker */}
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Pilih Jam</h2>
                                <p className="text-xs text-gray-400 mb-3">
                                    {selectedResource?.name} · {selectedDate}
                                    {totalDuration > 0 && ` · ~${totalDuration} menit`}
                                </p>
                                {loadingSlots ? (
                                    <div className="flex items-center gap-2 py-6">
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm text-gray-400">Mengecek ketersediaan...</span>
                                    </div>
                                ) : slots.length === 0 ? (
                                    <div className="py-6 text-center">
                                        <p className="text-2xl mb-1">😔</p>
                                        <p className="text-sm text-gray-500">Tidak ada slot tersedia untuk tanggal ini</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2">
                                        {slots.map(slot => (
                                            <button
                                                key={slot.time}
                                                disabled={!slot.available}
                                                onClick={() => setSelectedTime(slot.time === selectedTime ? "" : slot.time)}
                                                title={!slot.available ? slot.reason : ""}
                                                className={`py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${!slot.available ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through" :
                                                        selectedTime === slot.time ? "bg-gray-900 text-white shadow-md" :
                                                            "bg-white border border-gray-200 text-gray-700 hover:border-gray-900"
                                                    }`}
                                            >
                                                {slot.time}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Products */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="text-base font-bold text-gray-900">Pilih Layanan / Produk</h2>
                                    <span className="text-[10px] text-red-500 font-medium">*wajib min. 1</span>
                                </div>
                                <p className="text-xs text-gray-400 mb-3">Diperlukan sebagai jaminan booking</p>
                                <div className="space-y-2">
                                    {uniqueProducts.map(product => {
                                        const item = selectedItems.find(i => i.productId === product.id);
                                        const isSelected = !!item;
                                        return (
                                            <div key={product.id}
                                                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isSelected ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white hover:border-gray-300"}`}
                                                onClick={() => toggleItem(product)}>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "bg-gray-900 border-gray-900" : "border-gray-300"}`}>
                                                    {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {product.category && <span className="text-[10px] text-gray-400">{product.category}</span>}
                                                        {product.bookingDurationMin && (
                                                            <span className="text-[10px] text-gray-400">⏱ {product.bookingDurationMin} menit</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-sm font-bold text-gray-900">{fmtPrice(product.price)}</p>
                                                    {isSelected && (
                                                        <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => changeQty(product.id, -1)}
                                                                className="w-5 h-5 rounded-md bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center hover:bg-gray-300 transition-colors">−</button>
                                                            <span className="text-xs font-bold text-gray-900 w-4 text-center">{item.qty}</span>
                                                            <button onClick={() => changeQty(product.id, 1)}
                                                                className="w-5 h-5 rounded-md bg-gray-900 text-white text-xs font-bold flex items-center justify-center hover:bg-gray-700 transition-colors">+</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* DP Summary */}
                            {selectedItems.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-amber-800 mb-2">Ringkasan DP Jaminan</p>
                                    {selectedItems.map(i => (
                                        <div key={i.productId} className="flex justify-between text-xs text-amber-700 mb-1">
                                            <span>{i.product.name} × {i.qty}</span>
                                            <span className="font-medium">{fmtPrice(i.product.price * i.qty)}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-amber-200 pt-2 mt-2 flex justify-between">
                                        <span className="text-xs font-bold text-amber-900">Total DP</span>
                                        <span className="text-sm font-bold text-amber-900">{fmtPrice(totalDP)}</span>
                                    </div>
                                </div>
                            )}

                            <button
                                disabled={!selectedTime || selectedItems.length === 0}
                                onClick={() => setStep(2)}
                                className="w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Lanjut → Isi Data Diri
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: Customer Data ── */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-1">
                                ← Kembali
                            </button>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Data Diri</h2>
                                <p className="text-xs text-gray-400 mb-4">Diperlukan untuk konfirmasi booking via WhatsApp</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Nama Lengkap *</label>
                                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Nomor WhatsApp *</label>
                                        <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="08123456789"
                                            className="w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Catatan (opsional)</label>
                                        <textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)}
                                            placeholder="Contoh: mau potong rambut model fade..."
                                            rows={3}
                                            className="w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none" />
                                    </div>
                                </div>
                            </div>
                            <button
                                disabled={!customerName.trim() || !customerPhone.trim()}
                                onClick={() => setStep(3)}
                                className="w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Lanjut → Konfirmasi
                            </button>
                        </div>
                    )}

                    {/* ── STEP 3: Confirmation ── */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-1">
                                ← Kembali
                            </button>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Konfirmasi Booking</h2>
                                <p className="text-xs text-gray-400 mb-4">Periksa kembali detail pesananmu</p>
                            </div>

                            {/* Summary card */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="bg-gray-900 px-5 py-4">
                                    <p className="text-xs text-gray-400">Booking di</p>
                                    <p className="text-base font-bold text-white">{store.name}</p>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    <Row label="Tanggal" value={new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
                                    <Row label="Jam" value={selectedTime} />
                                    <Row label={resourceLabel(selectedResource?.type ?? "BARBER")} value={selectedResource?.name ?? ""} />
                                    {needsPax && <Row label="Jumlah Orang" value={`${pax} orang`} />}
                                    <Row label="Nama" value={customerName} />
                                    <Row label="WhatsApp" value={customerPhone} />
                                    {customerNote && <Row label="Catatan" value={customerNote} />}
                                </div>
                                <div className="px-5 py-4 bg-gray-50">
                                    <p className="text-xs font-semibold text-gray-500 mb-2">Layanan / Produk</p>
                                    {selectedItems.map(i => (
                                        <div key={i.productId} className="flex justify-between text-sm mb-1.5">
                                            <span className="text-gray-700">{i.product.name} × {i.qty}</span>
                                            <span className="font-medium text-gray-900">{fmtPrice(i.product.price * i.qty)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-5 py-4 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-amber-700 font-medium">Total DP Jaminan</p>
                                        <p className="text-[10px] text-amber-500">Dibayarkan sekarang</p>
                                    </div>
                                    <p className="text-xl font-black text-amber-900">{fmtPrice(totalDP)}</p>
                                </div>
                            </div>

                            {submitError && (
                                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{submitError}</div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-4 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Memproses...</>
                                ) : (
                                    <>🔒 Bayar DP & Konfirmasi Booking</>
                                )}
                            </button>
                            <p className="text-[10px] text-gray-400 text-center">
                                Pembayaran diproses dengan aman. DP akan digunakan sebagai jaminan kedatangan.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between px-5 py-3 gap-4">
            <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
            <span className="text-xs font-medium text-gray-900 text-right">{value}</span>
        </div>
    );
}