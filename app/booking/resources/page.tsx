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
  SectionCard,
  Toggle,
} from "@/components/booking/ui";

const FILTERS = ["ALL", "TABLE", "AREA", "ROOM", "BARBER"] as const;

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
    if (!ready) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, ready, status]);

  const filteredResources = useMemo(
    () => resources.filter((resource) => activeFilter === "ALL" || resource.type === activeFilter),
    [activeFilter, resources]
  );

  async function handleSubmit(form: Partial<BookingResource>) {
    if (!storeId) return;

    setSaving(true);
    setError("");

    try {
      if (editingResource) {
        const updated = await bookingApi.updateResource(editingResource.id, { ...form, storeId });
        setResources((current) =>
          current
            .map((item) => (item.id === editingResource.id ? updated : item))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        const created = await bookingApi.createResource({ ...form, storeId });
        setResources((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
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
      const updated = await bookingApi.updateResource(resource.id, {
        isActive: !resource.isActive,
        storeId,
      });
      setResources((current) => current.map((item) => (item.id === resource.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status resource.");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Hapus resource ini? Booking lama tetap tersimpan, tapi resource ini tidak bisa dipakai lagi."
    );
    if (!confirmed) return;

    try {
      await bookingApi.deleteResource(id);
      setResources((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus resource.");
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <LoadingState label="Memuat resource booking..." />
      </div>
    );
  }

  if (!ready && resources.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {error ? (
          <ErrorState description={error} retry={() => void load()} />
        ) : (
          <EmptyState
            title="Store belum ditemukan"
            description="Pastikan akun aktif memiliki store yang bisa diakses untuk mengelola resource booking."
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
              <span>Resource</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Resource Management</h1>
            <p className="mt-2 text-sm text-slate-500">
              Kelola area, meja, ruangan, atau kursi yang dipakai untuk menerima booking customer.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingResource(null);
              setModalOpen(true);
            }}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Tambah resource
          </button>
        </div>

        {error ? <ErrorState description={error} retry={() => void load()} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FILTERS.filter((filter) => filter !== "ALL").map((filter) => {
            const total = resources.filter((resource) => resource.type === filter).length;
            const active = resources.filter((resource) => resource.type === filter && resource.isActive).length;

            return (
              <div key={filter} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{RESOURCE_TYPE_LABEL[filter]}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{total}</p>
                <p className="mt-1 text-xs text-slate-400">{active} aktif</p>
              </div>
            );
          })}
        </div>

        <SectionCard
          title="Daftar Resource"
          description="Struktur dibuat ringkas supaya gampang scan status aktif, kapasitas, dan aksi edit."
        >
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === filter ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter === "ALL" ? "Semua" : RESOURCE_TYPE_LABEL[filter]}
              </button>
            ))}
          </div>

          {filteredResources.length === 0 ? (
            <EmptyState
              title="Belum ada resource"
              description="Tambahkan resource pertama untuk mulai menerima booking online."
              action={
                <button
                  onClick={() => {
                    setEditingResource(null);
                    setModalOpen(true);
                  }}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Tambah resource
                </button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="hidden grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Resource</span>
                <span>Tipe</span>
                <span>Kapasitas</span>
                <span>Status</span>
                <span className="text-right">Aksi</span>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {filteredResources.map((resource) => (
                  <article
                    key={resource.id}
                    className="grid gap-4 px-5 py-5 md:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_1fr] md:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">{resource.name}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {resource.description || "Tidak ada deskripsi tambahan."}
                      </p>
                    </div>

                    <div className="text-sm font-medium text-slate-700">{RESOURCE_TYPE_LABEL[resource.type]}</div>
                    <div className="text-sm text-slate-700">{resource.capacity ? `${resource.capacity} orang` : "-"}</div>

                    <div className="flex items-center gap-3">
                      <Toggle checked={resource.isActive} onChange={() => void handleToggle(resource)} />
                      <span className={`text-sm font-medium ${resource.isActive ? "text-emerald-600" : "text-slate-500"}`}>
                        {resource.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                      <button
                        onClick={() => {
                          setEditingResource(resource);
                          setModalOpen(true);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(resource.id)}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        Hapus
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <ResourceFormModal
        open={modalOpen}
        initialValue={editingResource}
        submitting={saving}
        onClose={() => {
          setModalOpen(false);
          setEditingResource(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
