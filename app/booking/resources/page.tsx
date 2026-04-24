"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResourceFormModal } from "@/components/booking/admin/resource-form-modal";
import { bookingApi } from "@/lib/booking/api";
import { RESOURCE_TYPE_LABEL } from "@/lib/booking/format";
import { useStoreIdentity } from "@/lib/booking/use-store-id";
import type { BookingResource } from "@/lib/booking/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Toggle,
} from "@/components/booking/ui";

const FILTERS = ["ALL", "TABLE", "AREA", "ROOM", "BARBER"] as const;

function getToday(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

function ResourceTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    TABLE: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <rect x="2" y="6" width="12" height="2" rx="1" stroke="currentColor" />
        <path d="M4 8v4M12 8v4M5 4h6" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    AREA: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" />
        <path d="M2 6h12M6 2v12" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    ROOM: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" />
        <path d="M6 13v-3a2 2 0 014 0v3" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    BARBER: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" />
        <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
  };
  return <span className="text-amber-700">{icons[type] ?? icons["TABLE"]}</span>;
}

export default function BookingResourcesPage() {
  const { storeId, ready, status } = useStoreIdentity();
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<BookingResource | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError("");
    try {
      const result = await bookingApi.getResources(storeId);
      setResources(result.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat resource.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!ready) { setLoading(false); return; }
    void load();
  }, [load, ready, status]);

  const filteredResources = useMemo(
    () => resources.filter((r) => activeFilter === "ALL" || r.type === activeFilter),
    [activeFilter, resources]
  );

  async function handleSubmit(form: Partial<BookingResource>) {
    if (!storeId) return;
    setSaving(true);
    setError("");
    try {
      if (editingResource) {
        const updated = await bookingApi.updateResource(editingResource.id, { ...form, storeId });
        setResources((c) => c.map((r) => (r.id === editingResource.id ? updated : r)).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const created = await bookingApi.createResource({ ...form, storeId });
        setResources((c) => [...c, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setModalOpen(false);
      setEditingResource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan resource.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(resource: BookingResource) {
    try {
      const updated = await bookingApi.updateResource(resource.id, { isActive: !resource.isActive, storeId });
      setResources((c) => c.map((r) => (r.id === resource.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status resource.");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Hapus resource ini? Booking lama tetap tersimpan.");
    if (!confirmed) return;
    try {
      await bookingApi.deleteResource(id);
      setResources((c) => c.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus resource.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Memuat resource booking..." />
        </div>
      </div>
    );
  }

  if (!ready && resources.length === 0) {
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

  const totalActive = resources.filter((r) => r.isActive).length;
  const totalInactive = resources.length - totalActive;

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
            <span className="text-gray-500">Resource</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{getToday()}</span>
            <button
              onClick={() => { setEditingResource(null); setModalOpen(true); }}
              className="text-xs bg-amber-700 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-amber-800 transition-colors"
            >
              + Tambah resource
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Total resource</p>
              <p className="text-xl font-medium text-gray-900">{resources.length}</p>
              <p className="text-xs text-gray-400 mt-1">semua tipe</p>
            </div>
            <div className={`rounded-xl p-4 border shadow-lg ${totalActive > 0 ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-400 mb-1">Aktif</p>
              <p className={`text-xl font-medium ${totalActive > 0 ? "text-emerald-700" : "text-gray-900"}`}>{totalActive}</p>
              <p className={`text-xs mt-1 ${totalActive > 0 ? "text-emerald-500" : "text-gray-400"}`}>
                {totalActive > 0 ? "siap menerima booking" : "belum ada yang aktif"}
              </p>
            </div>
            <div className={`rounded-xl p-4 border shadow-lg ${totalInactive > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-400 mb-1">Nonaktif</p>
              <p className={`text-xl font-medium ${totalInactive > 0 ? "text-red-600" : "text-gray-900"}`}>{totalInactive}</p>
              <p className={`text-xs mt-1 ${totalInactive > 0 ? "text-red-400" : "text-gray-400"}`}>
                {totalInactive > 0 ? "tidak muncul di booking" : "semua aktif"}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Tipe dipakai</p>
              <p className="text-xl font-medium text-gray-900">{new Set(resources.map((r) => r.type)).size}</p>
              <p className="text-xs text-gray-400 mt-1">dari 4 tipe tersedia</p>
            </div>
          </div>

          {error && <ErrorState description={error} retry={() => void load()} />}

          {/* Filter + table full width */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((filter) => {
                  const count = filter === "ALL"
                    ? resources.length
                    : resources.filter((r) => r.type === filter).length;
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold transition flex items-center gap-1 ${
                        activeFilter === filter
                          ? "bg-amber-700 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {filter === "ALL" ? "Semua" : RESOURCE_TYPE_LABEL[filter]}
                      <span className={`rounded-full px-1 text-[9px] font-bold ${
                        activeFilter === filter ? "bg-amber-600" : "bg-gray-200 text-gray-400"
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400">{filteredResources.length} resource</p>
            </div>

            {filteredResources.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="Belum ada resource"
                  description="Tambahkan resource pertama untuk mulai menerima booking online."
                  action={
                    <button
                      onClick={() => { setEditingResource(null); setModalOpen(true); }}
                      className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
                    >
                      Tambah resource
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[2fr_0.8fr_0.7fr_0.9fr_auto] gap-3 px-4 py-2.5 border-b border-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  <span>Resource</span>
                  <span>Tipe</span>
                  <span>Kapasitas</span>
                  <span>Status</span>
                  <span className="text-right">Aksi</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="grid md:grid-cols-[2fr_0.8fr_0.7fr_0.9fr_auto] gap-3 px-4 py-3.5 items-center hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          resource.isActive ? "bg-amber-50" : "bg-gray-100"
                        }`}>
                          <ResourceTypeIcon type={resource.type} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{resource.name}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            {resource.description || "Tidak ada deskripsi."}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-medium text-gray-600">
                        {RESOURCE_TYPE_LABEL[resource.type]}
                      </span>

                      <span className="text-[10px] text-gray-600">
                        {resource.capacity ? `${resource.capacity} orang` : "—"}
                      </span>

                      <div className="flex items-center gap-2">
                        <Toggle checked={resource.isActive} onChange={() => void handleToggle(resource)} />
                        <span className={`text-[10px] font-medium ${resource.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                          {resource.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => { setEditingResource(resource); setModalOpen(true); }}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(resource.id)}
                          className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <ResourceFormModal
        open={modalOpen}
        initialValue={editingResource}
        submitting={saving}
        onClose={() => { setModalOpen(false); setEditingResource(null); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}