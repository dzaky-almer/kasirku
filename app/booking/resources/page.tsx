"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";

// ── Types ──────────────────────────────────────────────────────
interface Resource {
    id: string;
    type: "BARBER" | "TABLE" | "AREA" | "ROOM";
    name: string;
    capacity: number | null;
    description: string | null;
    isActive: boolean;
}

interface SessionUser {
    storeId?: string;
}

const RESOURCE_TYPES = [
    { value: "BARBER", label: "Kursi Barber", desc: "Untuk barbershop/salon" },
    { value: "TABLE", label: "Meja", desc: "Untuk cafe/restoran" },
    { value: "AREA", label: "Area", desc: "Zona/area umum" },
    { value: "ROOM", label: "Ruangan", desc: "Private room / kamar" },
];

function typeInfo(type: string) {
    return RESOURCE_TYPES.find(t => t.value === type) ?? { value: type, label: type, icon: "📍", desc: "" };
}

// ── Resource Modal ─────────────────────────────────────────────
function ResourceModal({
    open, initial, onClose, onSave,
}: {
    open: boolean;
    initial: Partial<Resource> | null;
    onClose: () => void;
    onSave: (data: Partial<Resource>) => Promise<void>;
}) {
    const [form, setForm] = useState<Partial<Resource>>({
        type: "BARBER", name: "", capacity: null, description: "", isActive: true,
    });
    const [saving, setSaving] = useState(false);

    const needsCapacity = form.type === "TABLE" || form.type === "AREA" || form.type === "ROOM";

    useEffect(() => {
        if (!open) return;

        queueMicrotask(() => {
            setForm({
                type: initial?.type ?? "BARBER",
                name: initial?.name ?? "",
                capacity: initial?.capacity ?? null,
                description: initial?.description ?? "",
                isActive: initial?.isActive ?? true,
            });
        });
    }, [open, initial]);

    if (!open) return null;

    async function handleSave() {
        if (!form.name?.trim()) return;
        setSaving(true);
        await onSave(form);
        setSaving(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
                <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                        {initial?.id ? "Edit Aset" : "Tambah Aset Baru"}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-amber-700 text-xl leading-none transition-colors">×</button>
                </div>

                <div className="px-6 py-5 space-y-4">

                    {/* Type selector */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Tipe Aset *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {RESOURCE_TYPES.map(t => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setForm(f => ({
                                        ...f,
                                        type: t.value as Resource["type"],
                                        capacity: t.value === "BARBER" ? null : f.capacity
                                    }))}
                                    className={`p-3 rounded-xl border text-left transition-all
              ${form.type === t.value
                                            ? "border-amber-700 bg-amber-50 shadow-sm"
                                            : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/40"
                                        }`}
                                >
                                    <p className={`text-xs font-semibold ${form.type === t.value ? "text-amber-800" : "text-gray-800"}`}>
                                        {t.label}
                                    </p>
                                    <p className={`text-[10px] ${form.type === t.value ? "text-amber-600" : "text-gray-400"}`}>
                                        {t.desc}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Nama */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Nama Aset *</label>
                        <input
                            value={form.name ?? ""}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder={form.type === "BARBER" ? "Kursi 1, Barber Andi..." : form.type === "TABLE" ? "Meja A, Meja VIP..." : "Area Outdoor..."}
                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none transition-all
        focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                        />
                    </div>

                    {/* Capacity */}
                    {needsCapacity && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Kapasitas (orang)</label>
                            <input
                                type="number"
                                min={1}
                                value={form.capacity ?? ""}
                                onChange={e => setForm(f => ({ ...f, capacity: e.target.value ? parseInt(e.target.value) : null }))}
                                placeholder="Contoh: 4"
                                className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none transition-all
          focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">
                                Meja dengan kapasitas &lt; jumlah tamu akan otomatis dikunci
                            </p>
                        </div>
                    )}

                    {/* Deskripsi */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Deskripsi (opsional)</label>
                        <textarea
                            value={form.description ?? ""}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            placeholder="Keterangan tambahan tentang aset ini..."
                            className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl outline-none resize-none transition-all
        focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                        />
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                            className={`relative w-10 h-6 rounded-full transition-colors
            ${form.isActive ? "bg-amber-700" : "bg-gray-200"}`}
                        >
                            <span
                                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all
            ${form.isActive ? "left-5" : "left-1"}`}
                            />
                        </button>
                        <span className="text-xs text-gray-600">Aset aktif (bisa dipesan)</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs text-gray-600 hover:text-amber-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !form.name?.trim()}
                        className="px-5 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg
      hover:bg-amber-800 disabled:opacity-40 transition-all shadow-sm hover:shadow"
                    >
                        {saving ? "Menyimpan..." : initial?.id ? "Simpan Perubahan" : "Tambah Aset"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function BookingResourcesPage() {
    const { data: session, status } = useSession();
    const { demoStoreId, isDemoMode } = useDemoMode();
    const sessionUser = (session?.user ?? {}) as SessionUser;
    const storeId = isDemoMode ? demoStoreId : sessionUser.storeId ?? "";

    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Resource | null>(null);
    const [filterType, setFilterType] = useState<string>("ALL");

    const fetchResources = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await fetch(`/api/booking/resources?storeId=${storeId}`);
            const data = await res.json();
            setResources(data.resources ?? data ?? []);
        } catch {
            setError("Gagal memuat data aset.");
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (status === "loading" || !storeId) return;
        void fetchResources();
    }, [storeId, status, fetchResources]);

    async function handleSave(form: Partial<Resource>) {
        if (editTarget?.id) {
            await fetch(`/api/booking/resources/${editTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, storeId }),
            });
        } else {
            await fetch("/api/booking/resources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, storeId }),
            });
        }
        setModalOpen(false);
        setEditTarget(null);
        fetchResources();
    }

    async function handleToggle(r: Resource) {
        await fetch(`/api/booking/resources/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !r.isActive, storeId }),
        });
        fetchResources();
    }

    async function handleDelete(id: string) {
        if (!confirm("Hapus aset ini? Semua booking yang terkait akan terpengaruh.")) return;
        await fetch(`/api/booking/resources/${id}`, { method: "DELETE" });
        fetchResources();
    }

    const filtered = resources.filter(r => filterType === "ALL" ? true : r.type === filterType);
    const grouped = RESOURCE_TYPES.map(t => ({
        ...t,
        items: resources.filter(r => r.type === t.value),
    })).filter(g => g.items.length > 0);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <a href="/booking" className="text-gray-400 hover:text-gray-700 transition-colors text-sm">← Dashboard</a>
                        <span className="text-gray-200">|</span>
                        <span className="text-sm font-bold text-gray-900">Kelola Aset Booking</span>
                    </div>
                    <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors">
                        + Tambah Aset
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {error && <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}

                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-3">
                        {RESOURCE_TYPES.map(t => {
                            const count = resources.filter(r => r.type === t.value).length;
                            const active = resources.filter(r => r.type === t.value && r.isActive).length;
                            return (
                                <div key={t.value} className="bg-white rounded-xl p-4 border border-gray-100">
                                    <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
                                    <p className="text-xs text-gray-500">{t.label}</p>
                                    <p className="text-[10px] text-gray-400">{active} aktif</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filter */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 w-fit">
                        <button onClick={() => setFilterType("ALL")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === "ALL" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                            Semua
                        </button>
                        {RESOURCE_TYPES.map(t => (
                            <button key={t.value} onClick={() => setFilterType(t.value)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Resource list */}
                    {loading ? (
                        <div className="text-center py-16 text-gray-400 text-sm">Memuat aset...</div>
                    ) : resources.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-gray-600 font-medium text-sm">Belum ada aset</p>
                            <p className="text-gray-400 text-xs mt-1">Tambahkan aset yang bisa dipesan pelanggan</p>
                            <button onClick={() => setModalOpen(true)}
                                className="mt-4 px-4 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg">
                                + Tambah Aset Pertama
                            </button>
                        </div>
                    ) : filterType !== "ALL" ? (
                        // Flat list when filtered
                        <div className="grid grid-cols-1 gap-2">
                            {filtered.map(r => <ResourceRow key={r.id} r={r} onEdit={r => { setEditTarget(r); setModalOpen(true); }} onToggle={handleToggle} onDelete={handleDelete} />)}
                        </div>
                    ) : (
                        // Grouped by type
                        <div className="space-y-4">
                            {grouped.map(g => (
                                <div key={g.value}>
                                    <div className="flex items-center gap-2 mb-2">

                                        <h3 className="text-xs font-bold text-gray-600 tracking-wide uppercase">{g.label}</h3>
                                        <span className="text-[10px] text-gray-400">({g.items.length})</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {g.items.map(r => <ResourceRow key={r.id} r={r} onEdit={r => { setEditTarget(r); setModalOpen(true); }} onToggle={handleToggle} onDelete={handleDelete} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ResourceModal
                open={modalOpen}
                initial={editTarget}
                onClose={() => { setModalOpen(false); setEditTarget(null); }}
                onSave={handleSave}
            />
        </div>
    );
}

function ResourceRow({ r, onEdit, onToggle, onDelete }: {
    r: Resource;
    onEdit: (r: Resource) => void;
    onToggle: (r: Resource) => void;
    onDelete: (id: string) => void;
}) {
    const info = typeInfo(r.type);
    return (
        <div className={`bg-white rounded-xl border flex items-center gap-4 px-4 py-3.5 transition-all ${r.isActive ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                    {!r.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-gray-400">{info.label}</span>
                    {r.capacity && <span className="text-[10px] text-gray-400">· Kapasitas {r.capacity} orang</span>}
                    {r.description && <span className="text-[10px] text-gray-400 truncate max-w-[200px]">· {r.description}</span>}
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => onEdit(r)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Edit</button>
                <button onClick={() => onToggle(r)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${r.isActive ? "text-gray-500 hover:bg-gray-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"}`}>
                    {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button onClick={() => onDelete(r.id)} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">Hapus</button>
            </div>
        </div>
    );
}
