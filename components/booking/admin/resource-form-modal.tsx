"use client";

import { useState } from "react";
import type { BookingResource, BookingResourceType } from "@/lib/booking/types";
import { Toggle } from "@/components/booking/ui";

const RESOURCE_OPTIONS: Array<{
  value: BookingResourceType;
  label: string;
  description: string;
}> = [
  { value: "TABLE", label: "Meja", description: "Untuk cafe, resto, dan seating indoor/outdoor." },
  { value: "AREA", label: "Area", description: "Untuk zona booking seperti indoor, outdoor, atau smoking area." },
  { value: "ROOM", label: "Ruangan", description: "Untuk VIP room, private room, atau ruang meeting." },
  { value: "BARBER", label: "Kursi", description: "Untuk kursi barber, salon chair, atau station." },
];

export function ResourceFormModal({
  open,
  initialValue,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialValue: BookingResource | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (value: Partial<BookingResource>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<BookingResource>>(
    initialValue ?? {
      type: "TABLE",
      name: "",
      capacity: null,
      description: "",
      isActive: true,
    }
  );

  if (!open) return null;

  const needsCapacity = form.type !== "BARBER";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {initialValue ? "Edit Resource" : "Tambah Resource"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">Kelola meja, area, atau ruangan yang bisa dibooking.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-700">
            Tutup
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {RESOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm((current) => ({ ...current, type: option.value }))}
                className={`rounded-2xl border p-4 text-left transition ${
                  form.type === option.value
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400"
                }`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className={`mt-1 text-xs ${form.type === option.value ? "text-slate-300" : "text-slate-500"}`}>
                  {option.description}
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nama resource</span>
              <input
                value={form.name ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                placeholder="Contoh: Area Indoor"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Kapasitas</span>
              <input
                type="number"
                min={1}
                disabled={!needsCapacity}
                value={form.capacity ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capacity: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                placeholder={needsCapacity ? "Contoh: 4" : "Tidak wajib"}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Deskripsi</span>
            <textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              placeholder="Opsional, misalnya dekat jendela atau cocok untuk grup kecil."
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Resource aktif</p>
              <p className="text-xs text-slate-500">Jika nonaktif, resource tidak muncul di halaman booking.</p>
            </div>
            <Toggle
              checked={Boolean(form.isActive)}
              onChange={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-5">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            disabled={submitting || !form.name?.trim()}
            onClick={() => onSubmit(form)}
            className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : initialValue ? "Simpan perubahan" : "Tambah resource"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
