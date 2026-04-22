"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDemoMode } from "@/lib/demo";

// ── Types ──────────────────────────────────────────────────────
interface DashboardStats {
    totalDeposit: number;
    activeBookings: number;
    onlineBookings: number;
    offlineBookings: number;
    paidDepositCount: number;
    systemStatus: string;
}
interface ScheduleResource {
    id: string;
    name: string;
    type: string;
    capacity: number | null;
}
interface ScheduleBooking {
    id: string;
    customerName: string;
    customerPhone: string;
    startTime: string;
    endTime: string;
    resourceId: string;
    status: string;
    source: string;
    dpStatus: string;
    totalAmount: number;
    items: { product: { name: string }; qty: number }[];
}
interface BookingDetail {
    id: string;
    customerName: string;
    customerPhone: string;
    customerNote: string | null;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: string;
    source: string;
    dpStatus: string;
    totalAmount: number;
    pax: number;
    resource: { name: string; type: string };
    items: { product: { name: string; price: number }; qty: number; price: number }[];
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
    return `Rp ${n.toLocaleString("id-ID")}`;
}
function toInput(d: Date) { return d.toISOString().split("T")[0]; }

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "Menunggu", color: "text-amber-700", bg: "bg-amber-50" },
    CONFIRMED: { label: "Konfirmasi", color: "text-blue-700", bg: "bg-blue-50" },
    ARRIVED: { label: "Tiba", color: "text-emerald-700", bg: "bg-emerald-50" },
    COMPLETED: { label: "Selesai", color: "text-gray-600", bg: "bg-gray-100" },
    NO_SHOW: { label: "Tidak Hadir", color: "text-red-600", bg: "bg-red-50" },
};
const DP_LABEL: Record<string, { label: string; color: string }> = {
    UNPAID: { label: "Belum Bayar", color: "text-red-500" },
    PAID: { label: "Lunas", color: "text-emerald-600" },
    WAIVED: { label: "Dibebaskan", color: "text-gray-500" },
    FAILED: { label: "Gagal", color: "text-red-600" },
    FORFEITED: { label: "Hangus", color: "text-orange-600" },
};

function sourceTag(source: string) {
    return source === "ONLINE"
        ? <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md">Online</span>
        : <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-md">Walk-in</span>;
}

// ── Offline booking modal ──────────────────────────────────────
function OfflineModal({
    open, storeId, date, resources, onClose, onSaved,
}: {
    open: boolean;
    storeId: string;
    date: string;
    resources: ScheduleResource[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState({
        customerName: "", customerPhone: "", startTime: "", resourceId: "",
        pax: 1, customerNote: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) setForm({ customerName: "", customerPhone: "", startTime: "", resourceId: resources[0]?.id ?? "", pax: 1, customerNote: "" });
    }, [open, resources]);

    if (!open) return null;

    async function handleSave() {
        if (!form.customerName || !form.customerPhone || !form.startTime || !form.resourceId) {
            setError("Lengkapi semua field yang wajib"); return;
        }
        setSaving(true); setError("");
        try {
            const res = await fetch("/api/booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId, bookingDate: date, source: "OFFLINE", ...form }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Gagal");
            onSaved(); onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                    <h3 className="text-sm font-bold text-gray-900">Booking Walk-in / Offline</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="px-6 py-4 space-y-3.5">
                    {error && <div className="px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg">{error}</div>}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nama Pelanggan *</label>
                            <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                                placeholder="Budi" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">WhatsApp *</label>
                            <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                                placeholder="08xxx" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Jam Mulai *</label>
                            <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Jumlah Orang</label>
                            <input type="number" min={1} value={form.pax} onChange={e => setForm(f => ({ ...f, pax: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Aset *</label>
                        <select value={form.resourceId} onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900 bg-white">
                            {resources.map(r => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (maks ${r.capacity})` : ""}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Catatan</label>
                        <textarea value={form.customerNote} onChange={e => setForm(f => ({ ...f, customerNote: e.target.value }))}
                            rows={2} placeholder="Opsional..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-900 resize-none" />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 hover:text-gray-800 transition-colors">Batal</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-5 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
                        {saving ? "Menyimpan..." : "Simpan Booking"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Booking Detail Drawer ──────────────────────────────────────
function BookingDrawer({ booking, onClose, onUpdate }: {
    booking: BookingDetail | null;
    onClose: () => void;
    onUpdate: () => void;
}) {
    const [updating, setUpdating] = useState(false);

    if (!booking) return null;

    async function updateField(field: "status" | "dpStatus", value: string) {
        setUpdating(true);
        await fetch(`/api/booking/${booking!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
        });
        setUpdating(false);
        onUpdate();
    }

    const st = STATUS_LABEL[booking.status] ?? { label: booking.status, color: "text-gray-500", bg: "bg-gray-100" };
    const dp = DP_LABEL[booking.dpStatus] ?? { label: booking.dpStatus, color: "text-gray-500" };

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl flex flex-col">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="text-sm font-bold text-gray-900">Detail Booking</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
                </div>
                <div className="flex-1 p-5 space-y-5">
                    {/* Customer */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-0.5">Pelanggan</p>
                        <p className="text-base font-bold text-gray-900">{booking.customerName}</p>
                        <a href={`https://wa.me/${booking.customerPhone.replace(/\D/g, "")}`} target="_blank"
                            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 mt-1">
                            <span>📱</span>{booking.customerPhone}
                        </a>
                        {booking.customerNote && (
                            <p className="text-xs text-gray-500 mt-2 italic">"{booking.customerNote}"</p>
                        )}
                    </div>

                    {/* Info */}
                    <div className="space-y-2">
                        {[
                            { label: "Tanggal", value: new Date(booking.bookingDate).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) },
                            { label: "Jam", value: `${booking.startTime} – ${booking.endTime}` },
                            { label: "Aset", value: `${booking.resource.name}` },
                            { label: "Pax", value: `${booking.pax} orang` },
                        ].map(r => (
                            <div key={r.label} className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-xs text-gray-400">{r.label}</span>
                                <span className="text-xs font-medium text-gray-900">{r.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Status + source */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                        {sourceTag(booking.source)}
                        <span className={`text-xs font-medium ${dp.color}`}>{dp.label}</span>
                    </div>

                    {/* Items */}
                    {booking.items.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Layanan / Produk</p>
                            <div className="space-y-1.5">
                                {booking.items.map((it, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-700">{it.product.name} × {it.qty}</span>
                                        <span className="font-medium text-gray-900">Rp {(it.price * it.qty).toLocaleString("id-ID")}</span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 pt-2 flex justify-between">
                                    <span className="text-xs font-bold text-gray-700">Total DP</span>
                                    <span className="text-sm font-bold text-gray-900">Rp {booking.totalAmount.toLocaleString("id-ID")}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Update status */}
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Update Status Booking</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(["CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const).map(s => (
                                    <button key={s} onClick={() => updateField("status", s)} disabled={updating || booking.status === s}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${booking.status === s
                                                ? `${STATUS_LABEL[s].bg} ${STATUS_LABEL[s].color} font-bold`
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            } disabled:opacity-50`}>
                                        {STATUS_LABEL[s].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Update Status DP</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(["PAID", "WAIVED", "FORFEITED"] as const).map(s => (
                                    <button key={s} onClick={() => updateField("dpStatus", s)} disabled={updating || booking.dpStatus === s}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${booking.dpStatus === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            } disabled:opacity-50`}>
                                        {DP_LABEL[s].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Schedule Board ─────────────────────────────────────────────
function ScheduleBoard({
    resources, bookings, openTime, closeTime, slotMin, onClickBooking,
}: {
    resources: ScheduleResource[];
    bookings: ScheduleBooking[];
    openTime: string;
    closeTime: string;
    slotMin: number;
    onClickBooking: (id: string) => void;
}) {
    // Generate time labels
    function timeToMin(t: string) {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    }
    function minToTime(m: number) {
        const h = Math.floor(m / 60).toString().padStart(2, "0");
        const min = (m % 60).toString().padStart(2, "0");
        return `${h}:${min}`;
    }

    const startMin = timeToMin(openTime);
    const endMin = timeToMin(closeTime);
    const totalMin = endMin - startMin;
    const slotCount = Math.ceil(totalMin / slotMin);
    const slots = Array.from({ length: slotCount }, (_, i) => minToTime(startMin + i * slotMin));

    const CELL_W = 80; // px per slot
    const ROW_H = 64;  // px per resource row

    function getBookingStyle(b: ScheduleBooking) {
        const bStart = timeToMin(b.startTime);
        const bEnd = timeToMin(b.endTime);
        const left = ((bStart - startMin) / slotMin) * CELL_W;
        const width = Math.max(((bEnd - bStart) / slotMin) * CELL_W - 4, CELL_W - 4);
        return { left, width };
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <div style={{ minWidth: slots.length * CELL_W + 120 }}>
                    {/* Header: time labels */}
                    <div className="flex border-b border-gray-100 bg-gray-50">
                        <div className="w-28 flex-shrink-0 px-3 py-2 text-[10px] font-medium text-gray-400 border-r border-gray-100">ASET</div>
                        {slots.map(t => (
                            <div key={t} style={{ width: CELL_W, flexShrink: 0 }}
                                className="text-center py-2 text-[10px] text-gray-400 border-r border-gray-50">
                                {t}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {resources.map(res => {
                        const resBookings = bookings.filter(b => b.resourceId === res.id);
                        return (
                            <div key={res.id} className="flex border-b border-gray-50 last:border-b-0" style={{ height: ROW_H }}>
                                {/* Resource label */}
                                <div className="w-28 flex-shrink-0 px-3 flex flex-col justify-center border-r border-gray-100 bg-gray-50/50">
                                    <p className="text-xs font-semibold text-gray-800 truncate">{res.name}</p>
                                    {res.capacity && <p className="text-[10px] text-gray-400">maks {res.capacity}</p>}
                                </div>
                                {/* Timeline */}
                                <div className="relative flex-1" style={{ width: slots.length * CELL_W }}>
                                    {/* Grid lines */}
                                    {slots.map((t, i) => (
                                        <div key={t} style={{ left: i * CELL_W, width: CELL_W }}
                                            className="absolute top-0 bottom-0 border-r border-gray-50" />
                                    ))}
                                    {/* Bookings */}
                                    {resBookings.map(b => {
                                        const { left, width } = getBookingStyle(b);
                                        const isOnline = b.source === "ONLINE";
                                        const isPaid = b.dpStatus === "PAID";
                                        return (
                                            <button
                                                key={b.id}
                                                onClick={() => onClickBooking(b.id)}
                                                style={{ left: left + 2, width, top: 6, bottom: 6 }}
                                                className={`absolute rounded-lg px-2 py-1 text-left transition-all hover:shadow-md hover:z-10 border ${b.status === "NO_SHOW" ? "bg-red-50 border-red-200" :
                                                        b.status === "COMPLETED" ? "bg-gray-100 border-gray-200" :
                                                            isOnline
                                                                ? isPaid ? "bg-blue-50 border-blue-300" : "bg-blue-50/60 border-blue-200 border-dashed"
                                                                : "bg-amber-50 border-amber-200"
                                                    }`}>
                                                <p className={`text-[10px] font-bold truncate ${b.status === "NO_SHOW" ? "text-red-700" : b.status === "COMPLETED" ? "text-gray-500" : isOnline ? "text-blue-800" : "text-amber-800"}`}>
                                                    {b.customerName}
                                                </p>
                                                <p className={`text-[9px] truncate ${isOnline ? "text-blue-500" : "text-amber-500"}`}>
                                                    {b.startTime} · {b.items.map(i => i.product.name).join(", ")}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {isOnline && <span className="text-[8px] bg-blue-200 text-blue-800 px-1 rounded font-bold">Online</span>}
                                                    {isPaid && <span className="text-[8px] bg-emerald-200 text-emerald-800 px-1 rounded font-bold">DP✓</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function BookingDashboardPage() {
    const { data: session, status } = useSession();
    const { demoStoreId, isDemoMode } = useDemoMode();
    const storeId = isDemoMode ? demoStoreId : (session?.user as any)?.storeId ?? "";
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(toInput(new Date()));
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [resources, setResources] = useState<ScheduleResource[]>([]);
    const [bookings, setBookings] = useState<ScheduleBooking[]>([]);
    const [storeSettings, setStoreSettings] = useState<{ bookingOpenTime: string; bookingCloseTime: string; bookingSlotMinutes: number } | null>(null);
    const [loading, setLoading] = useState(false);

    // Booking detail
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detail, setDetail] = useState<BookingDetail | null>(null);

    // Offline modal
    const [offlineOpen, setOfflineOpen] = useState(false);

    // Slug for public link
    const [storeSlug, setStoreSlug] = useState("");

    const fetchAll = useCallback(async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            const [statsRes, schedRes, resRes] = await Promise.all([
                fetch(`/api/booking/dashboard?storeId=${storeId}&date=${selectedDate}`),
                fetch(`/api/booking/schedule?storeId=${storeId}&date=${selectedDate}`),
                fetch(`/api/booking/resources?storeId=${storeId}`),
            ]);
            const [statsData, schedData, resData] = await Promise.all([
                statsRes.json(), schedRes.json(), resRes.json(),
            ]);
            setStats(statsData);
            setResources(schedData.resources ?? resData.resources ?? []);
            setBookings(schedData.bookings ?? []);
            setStoreSettings({
                bookingOpenTime: schedData.openTime ?? "08:00",
                bookingCloseTime: schedData.closeTime ?? "21:00",
                bookingSlotMinutes: schedData.slotMinutes ?? 30,
            });
            setStoreSlug(schedData.slug ?? "");
        } catch { }
        setLoading(false);
    }, [storeId, selectedDate]);

    useEffect(() => {
        if (status === "loading" || !storeId) return;
        fetchAll();
        const interval = setInterval(fetchAll, 30_000); // refresh every 30s
        return () => clearInterval(interval);
    }, [storeId, status, fetchAll]);

    async function fetchDetail(id: string) {
        const res = await fetch(`/api/booking/${id}`);
        const data = await res.json();
        setDetail(data.booking ?? data);
        setDetailId(id);
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* HEADER */}
                <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900">Booking Dashboard</span>
                    <div className="flex items-center gap-2">
                        {storeSlug && (
                            <a href={`/book/${storeSlug}`} target="_blank"
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                                Link Booking
                            </a>
                        )}
                        <button onClick={() => router.push("/booking/resources")}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-200 transition-colors">
                            Kelola Aset
                        </button>
                        <button onClick={() => router.push("/booking/settings")}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-200 transition-colors">
                            Pengaturan
                        </button>
                        <button onClick={() => setOfflineOpen(true)}
                            className="px-3 py-1.5 text-xs font-medium bg-amber-700 text-white rounded-lg hover:bg-gray-800 transition-colors">
                            + Booking Walk-in
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Date picker */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() - 1);
                                setSelectedDate(toInput(d));
                            }} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">←</button>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                className="px-3 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-gray-900" />
                            <button onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                setSelectedDate(toInput(d));
                            }} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">→</button>
                        </div>
                        <button onClick={() => setSelectedDate(toInput(new Date()))}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
                            Hari ini
                        </button>
                        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-400">
                            <span className={`w-2 h-2 rounded-full ${stats?.systemStatus === "ok" ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
                            {loading ? "Memuat..." : "Live"}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: "Total Deposit Masuk", value: fmt(stats?.totalDeposit ?? 0), sub: "hari ini", icon: "" },
                            { label: "Total Booking Aktif", value: stats?.activeBookings ?? 0, sub: "reservasi", icon: "" },
                            { label: "Online", value: stats?.onlineBookings ?? 0, sub: `${stats?.paidDepositCount ?? 0} DP lunas`, icon: "" },
                            { label: "Walk-in", value: stats?.offlineBookings ?? 0, sub: "langsung datang", icon: "" },
                        ].map(c => (
                            <div key={c.label} className="bg-white rounded-xl p-4 border border-gray-100 flex items-start gap-3">
                                <span className="text-xl">{c.icon}</span>
                                <div>
                                    <p className="text-xs text-gray-400">{c.label}</p>
                                    <p className="text-xl font-bold text-gray-900">{c.value}</p>
                                    <p className="text-[10px] text-gray-400">{c.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Schedule board */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-gray-800">Schedule Board</h2>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="w-3 h-2 rounded bg-blue-200 inline-block border border-blue-300" />Online (DP)
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="w-3 h-2 rounded bg-amber-100 inline-block border border-amber-200" />Walk-in
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="w-3 h-2 rounded bg-red-50 inline-block border border-red-200" />No-show
                                </span>
                            </div>
                        </div>
                        {resources.length === 0 ? (
                            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                                <p className="text-gray-500 text-sm font-medium">Belum ada aset booking</p>
                                <p className="text-gray-400 text-xs mt-1">Tambahkan aset terlebih dahulu di menu "Kelola Aset"</p>
                                <button onClick={() => router.push("/booking/resources")}
                                    className="mt-4 px-4 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg">
                                    + Tambah Aset
                                </button>
                            </div>
                        ) : storeSettings ? (
                            <ScheduleBoard
                                resources={resources}
                                bookings={bookings}
                                openTime={storeSettings.bookingOpenTime}
                                closeTime={storeSettings.bookingCloseTime}
                                slotMin={storeSettings.bookingSlotMinutes}
                                onClickBooking={id => fetchDetail(id)}
                            />
                        ) : null}
                    </div>

                    {/* Booking list today */}
                    {bookings.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-100">
                                <p className="text-xs font-bold text-gray-700">SEMUA BOOKING HARI INI ({bookings.length})</p>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        {["JAM", "PELANGGAN", "ASET", "LAYANAN", "DP", "STATUS", ""].map(h => (
                                            <th key={h} className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {bookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => {
                                        const st = STATUS_LABEL[b.status];
                                        const dp = DP_LABEL[b.dpStatus];
                                        const res = resources.find(r => r.id === b.resourceId);
                                        return (
                                            <tr key={b.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fetchDetail(b.id)}>
                                                <td className="px-4 py-3 text-sm font-mono text-gray-700">{b.startTime}</td>
                                                <td className="px-4 py-3">
                                                    <p className="text-sm font-medium text-gray-900">{b.customerName}</p>
                                                    <p className="text-[10px] text-gray-400">{b.customerPhone}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-600">{res?.name ?? "—"}</td>
                                                <td className="px-4 py-3 text-xs text-gray-600">{b.items.map(i => i.product.name).join(", ") || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-medium ${dp.color}`}>{dp.label}</span>
                                                    {b.totalAmount > 0 && <p className="text-[10px] text-gray-400">{fmt(b.totalAmount)}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st?.bg} ${st?.color}`}>{st?.label}</span>
                                                </td>
                                                <td className="px-4 py-3">{sourceTag(b.source)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Booking detail drawer */}
            <BookingDrawer
                booking={detail}
                onClose={() => { setDetailId(null); setDetail(null); }}
                onUpdate={() => { fetchAll(); if (detailId) fetchDetail(detailId); }}
            />

            {/* Offline modal */}
            <OfflineModal
                open={offlineOpen}
                storeId={storeId}
                date={selectedDate}
                resources={resources}
                onClose={() => setOfflineOpen(false)}
                onSaved={fetchAll}
            />
        </div>
    );
}