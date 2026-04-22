"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";

interface BookingSettings {
    bookingOpenTime: string;
    bookingCloseTime: string;
    bookingSlotMinutes: number;
    bookingGraceMinutes: number;
}
interface BookingProduct {
    id: string;
    name: string;
    price: number;
    category: string | null;
    bookingEnabled: boolean;
    bookingDurationMin: number | null;
}

interface SessionUser {
    storeId?: string;
}

function fmtPrice(n: number) {
    return "Rp " + n.toLocaleString("id-ID");
}

export default function BookingSettingsPage() {
    const { data: session, status } = useSession();
    const { demoStoreId, isDemoMode } = useDemoMode();
    const sessionUser = (session?.user ?? {}) as SessionUser;
    const storeId = isDemoMode ? demoStoreId : sessionUser.storeId ?? "";

    const [settings, setSettings] = useState<BookingSettings>({
        bookingOpenTime: "08:00",
        bookingCloseTime: "21:00",
        bookingSlotMinutes: 30,
        bookingGraceMinutes: 15,
    });
    const [products, setProducts] = useState<BookingProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (status === "loading" || !storeId) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/booking/settings?storeId=${storeId}`).then(r => r.json()),
            fetch(`/api/products?storeId=${storeId}`).then(r => r.json()),
        ]).then(([settingsData, productsData]) => {
            if (settingsData.bookingOpenTime) setSettings(settingsData);
            setProducts(productsData.products ?? productsData ?? []);
        }).catch(() => setError("Gagal memuat pengaturan."))
            .finally(() => setLoading(false));
    }, [storeId, status]);

    async function saveSettings() {
        setSaving(true); setSavedMsg(""); setError("");
        try {
            const res = await fetch("/api/booking/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId, ...settings }),
            });
            if (!res.ok) throw new Error();
            setSavedMsg("Pengaturan berhasil disimpan!");
            setTimeout(() => setSavedMsg(""), 3000);
        } catch {
            setError("Gagal menyimpan pengaturan.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleProduct(product: BookingProduct, bookingEnabled: boolean) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, bookingEnabled } : p));
        await fetch(`/api/booking/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingEnabled }),
        });
    }

    async function updateDuration(product: BookingProduct, bookingDurationMin: number | null) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, bookingDurationMin } : p));
        await fetch(`/api/booking/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingDurationMin }),
        });
    }

    // Generate preview slots
    function previewSlots() {
        const [oh, om] = settings.bookingOpenTime.split(":").map(Number);
        const [ch, cm] = settings.bookingCloseTime.split(":").map(Number);
        const startMin = oh * 60 + om;
        const endMin = ch * 60 + cm;
        const slotMin = settings.bookingSlotMinutes;
        const slots = [];
        for (let m = startMin; m < endMin; m += slotMin) {
            const h = Math.floor(m / 60).toString().padStart(2, "0");
            const min = (m % 60).toString().padStart(2, "0");
            slots.push(`${h}:${min}`);
        }
        return slots;
    }
    const previewList = previewSlots();

    const enabledProducts = products.filter(p => p.bookingEnabled);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <a href="/booking" className="text-gray-400 hover:text-gray-700 transition-colors text-sm">← Dashboard</a>
                        <span className="text-gray-200">|</span>
                        <span className="text-sm font-bold text-gray-900">Pengaturan Booking</span>
                    </div>
                    <button onClick={saveSettings} disabled={saving}
                        className="px-5 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
                        {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="text-center py-16 text-gray-400 text-sm">Memuat pengaturan...</div>
                    ) : (
                        <div className="max-w-2xl space-y-5">
                            {error && <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}
                            {savedMsg && <div className="px-4 py-3 bg-emerald-50 text-emerald-700 text-sm rounded-xl font-medium">✓ {savedMsg}</div>}

                            {/* Jam Operasional */}
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    
                                    <h2 className="text-sm font-bold text-gray-900">Jam Operasional Booking</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Jam Buka</label>
                                        <input type="time" value={settings.bookingOpenTime}
                                            onChange={e => setSettings(s => ({ ...s, bookingOpenTime: e.target.value }))}
                                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Jam Tutup</label>
                                        <input type="time" value={settings.bookingCloseTime}
                                            onChange={e => setSettings(s => ({ ...s, bookingCloseTime: e.target.value }))}
                                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900" />
                                    </div>
                                </div>
                            </div>

                            {/* Slot & Grace */}
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    
                                    <h2 className="text-sm font-bold text-gray-900">Durasi & Toleransi</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Interval Slot (menit)</label>
                                        <select value={settings.bookingSlotMinutes}
                                            onChange={e => setSettings(s => ({ ...s, bookingSlotMinutes: parseInt(e.target.value) }))}
                                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 bg-white">
                                            {[15, 30, 45, 60, 90, 120].map(v => (
                                                <option key={v} value={v}>{v} menit</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-1">Jarak antar pilihan jam booking</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Toleransi Keterlambatan (menit)</label>
                                        <select value={settings.bookingGraceMinutes}
                                            onChange={e => setSettings(s => ({ ...s, bookingGraceMinutes: parseInt(e.target.value) }))}
                                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none focus:border-gray-900 bg-white">
                                            {[0, 5, 10, 15, 20, 30].map(v => (
                                                <option key={v} value={v}>{v === 0 ? "Tidak ada toleransi" : `${v} menit`}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-1">Sebelum booking otomatis jadi no-show</p>
                                    </div>
                                </div>

                                {/* Slot preview */}
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Preview slot yang akan muncul di halaman booking:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {previewList.slice(0, 16).map(t => (
                                            <span key={t} className="px-2.5 py-1 text-[11px] bg-gray-100 text-gray-600 rounded-lg font-mono">{t}</span>
                                        ))}
                                        {previewList.length > 16 && (
                                            <span className="px-2.5 py-1 text-[11px] bg-gray-50 text-gray-400 rounded-lg">+{previewList.length - 16} lainnya</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">Total {previewList.length} slot per hari</p>
                                </div>
                            </div>

                            {/* Products for booking */}
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        
                                        <h2 className="text-sm font-bold text-gray-900">Produk / Layanan untuk Booking</h2>
                                    </div>
                                    <span className="text-xs text-gray-400">{enabledProducts.length} aktif dari {products.length}</span>
                                </div>
                                <p className="text-xs text-gray-400 mb-4">Aktifkan produk yang bisa dipilih pelanggan saat booking online. Harga produk = nominal DP jaminan.</p>

                                {products.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">Belum ada produk. Tambahkan produk di menu Produk terlebih dahulu.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {products.map(p => (
                                            <div key={p.id} className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${p.bookingEnabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"}`}>
                                                {/* Toggle */}
                                                <button onClick={() => toggleProduct(p, !p.bookingEnabled)}
                                                    className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${p.bookingEnabled ? "bg-gray-900" : "bg-gray-200"}`}>
                                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${p.bookingEnabled ? "left-4" : "left-0.5"}`} />
                                                </button>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${p.bookingEnabled ? "text-gray-900" : "text-gray-400"}`}>{p.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {p.category && <span className="text-[10px] text-gray-400">{p.category}</span>}
                                                        <span className="text-[10px] text-gray-400">DP: {fmtPrice(p.price)}</span>
                                                    </div>
                                                </div>
                                                {/* Duration input — only when enabled */}
                                                {p.bookingEnabled && (
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="text-[10px] text-gray-400">Durasi:</span>
                                                        <input
                                                            type="number" min={5} step={5}
                                                            value={p.bookingDurationMin ?? ""}
                                                            onChange={e => updateDuration(p, e.target.value ? parseInt(e.target.value) : null)}
                                                            placeholder="30"
                                                            className="w-14 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-lg outline-none focus:border-gray-900 text-center"
                                                        />
                                                        <span className="text-[10px] text-gray-400">mnt</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Info box */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <p className="text-xs font-semibold text-black mb-2">Info Sistem Booking</p>
                                <ul className="text-xs text-blue-700 space-y-1.5">
                                    <li>• Pelanggan booking melalui link: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/book/[slug-toko-kamu]</code></li>
                                    <li>• Produk yang diaktifkan otomatis muncul di halaman booking pelanggan</li>
                                    <li>• Durasi layanan digunakan untuk menghitung slot yang terisi (mencegah double booking)</li>
                                    <li>• Buffer 10 menit otomatis ditambahkan antar sesi untuk barbershop</li>
                                    <li>• Slot akan otomatis terkunci jika sudah dipesan (real-time)</li>
                                </ul>
                            </div>

                            {/* Save button bottom */}
                            <button onClick={saveSettings} disabled={saving}
                                className="w-full py-3.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all">
                                {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
