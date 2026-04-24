"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bookingApi } from "@/lib/booking/api";
import {
  BOOKING_STATUS_META,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  RESOURCE_TYPE_LABEL,
  shiftDate,
  todayInJakarta,
} from "@/lib/booking/format";
import { useStoreIdentity } from "@/lib/booking/use-store-id";
import type { BookingListItem, BookingScheduleResponse, BookingSettingsResponse } from "@/lib/booking/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from "@/components/booking/ui";

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const;

// ── Shared primitives (sama persis dengan dashboard) ──
function getToday(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

export default function BookingDashboardPage() {
  const { storeId, ready, status } = useStoreIdentity();
  const [selectedDate, setSelectedDate] = useState(todayInJakarta());
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [settings, setSettings] = useState<BookingSettingsResponse | null>(null);
  const [schedule, setSchedule] = useState<BookingScheduleResponse | null>(null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [detail, setDetail] = useState<BookingListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, scheduleResponse, listResponse] = await Promise.all([
        bookingApi.getSettings(storeId),
        bookingApi.getSchedule(storeId, selectedDate),
        bookingApi.getBookingList(storeId, { date: selectedDate, status: selectedStatus }),
      ]);
      setSettings(settingsResponse);
      setSchedule(scheduleResponse);
      setBookings(listResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard booking.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStatus, storeId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!ready) { setLoading(false); return; }
    void load();
  }, [load, ready, status]);

  const metrics = useMemo(() => {
    const source = schedule?.bookings ?? bookings;
    const totalRevenue = source.filter((b) => b.dpStatus === "PAID").reduce((s, b) => s + b.dpAmount, 0);
    const todayBookings = source.filter((b) => b.status !== "NO_SHOW").length;
    const resourceCount = schedule?.resources.length ?? 0;
    return {
      totalBookings: source.length,
      todayBookings,
      totalRevenue,
      occupancyRate: resourceCount > 0 ? Math.min(100, Math.round((todayBookings / resourceCount) * 100)) : 0,
    };
  }, [bookings, schedule]);

  async function openDetail(id: string) {
    try {
      const result = await bookingApi.getBookingDetail(id);
      setDetail(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail booking.");
    }
  }

  async function updateDetail(payload: { status?: string; dpStatus?: string }) {
    if (!detail) return;
    setUpdating(true);
    try {
      const updated = await bookingApi.updateBookingStatus(detail.id, payload);
      setDetail(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui booking.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <LoadingState label="Memuat booking dashboard..." />
        </div>
      </div>
    );
  }

  if (!ready || !settings || !schedule) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-6">
          {error ? (
            <ErrorState description={error} retry={() => void load()} />
          ) : (
            <EmptyState
              title="Store booking belum siap"
              description="Pastikan store aktif dan pengaturan booking sudah tersedia."
            />
          )}
        </div>
      </div>
    );
  }

  const publicBookingKey = settings.slug || settings.id;
  const publicBookingHref = `/book/${publicBookingKey}`;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header identik dashboard ── */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-lg">
          <span className="text-sm font-medium text-gray-900">Booking Dashboard</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {settings.name}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              {getToday()}
            </span>
            <Link
              href={publicBookingHref}
              target="_blank"
              className="text-xs bg-amber-700 text-white px-3 py-1 rounded-full font-medium hover:bg-amber-800 transition-colors"
            >
              Halaman publik ↗
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* ── METRIC CARDS (4 kartu persis dashboard) ── */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Total booking</p>
              <p className="text-xl font-medium text-gray-900">{metrics.totalBookings}</p>
              <p className="text-xs text-gray-400 mt-1">
                {formatDateLabel(selectedDate, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Booking aktif</p>
              <p className="text-xl font-medium text-gray-900">{metrics.todayBookings}</p>
              <p className="text-xs text-gray-400 mt-1">tidak termasuk no-show</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-lg">
              <p className="text-xs text-gray-400 mb-1">Revenue DP</p>
              <p className="text-xl font-medium text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">akumulasi DP berstatus PAID</p>
            </div>
            <div className={`rounded-xl p-4 border shadow-lg ${metrics.occupancyRate >= 80 ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-400 mb-1">Occupancy rate</p>
              <p className={`text-xl font-medium ${metrics.occupancyRate >= 80 ? "text-emerald-700" : "text-gray-900"}`}>
                {metrics.occupancyRate}%
              </p>
              <p className={`text-xs mt-1 ${metrics.occupancyRate >= 80 ? "text-emerald-500" : "text-gray-400"}`}>
                {metrics.occupancyRate >= 80 ? "padat hari ini" : "pendekatan per resource"}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5">
              <ErrorState description={error} retry={() => void load()} />
            </div>
          )}

          {/* ── GRID UTAMA: schedule + list (col-span-2) | sidebar kanan ── */}
          <div className="grid grid-cols-3 gap-3">

            {/* Kiri: Schedule + List */}
            <div className="col-span-2 space-y-3">

              {/* Filter bar — compact */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">FILTER BOOKING</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedDate((c) => shiftDate(c, -1))}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    ← Kemarin
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900 transition"
                  />
                  <button
                    onClick={() => setSelectedDate((c) => shiftDate(c, 1))}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Besok →
                  </button>
                  <button
                    onClick={() => setSelectedDate(todayInJakarta())}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Hari ini
                  </button>

                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((item) => (
                      <button
                        key={item}
                        onClick={() => setSelectedStatus(item)}
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                          selectedStatus === item
                            ? "bg-amber-700 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {item === "ALL" ? "Semua" : BOOKING_STATUS_META[item]?.label ?? item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule Board */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">SCHEDULE BOARD</p>
                {schedule.resources.length === 0 ? (
                  <EmptyState
                    title="Belum ada resource aktif"
                    description="Tambahkan resource aktif agar jadwal booking dapat ditampilkan."
                    action={
                      <Link
                        href="/booking/resources"
                        className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
                      >
                        Tambah resource
                      </Link>
                    }
                  />
                ) : (
                  <ScheduleBoard
                    resources={schedule.resources}
                    bookings={schedule.bookings}
                    openTime={settings.bookingOpenTime}
                    closeTime={settings.bookingCloseTime}
                    slotMinutes={settings.bookingSlotMinutes}
                    selectedDate={selectedDate}
                    onSelectBooking={openDetail}
                  />
                )}
              </div>

              {/* Booking List */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">DAFTAR BOOKING</p>
                {bookings.length === 0 ? (
                  <EmptyState title="Tidak ada booking" description="Belum ada booking yang cocok dengan filter saat ini." />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{booking.customerName}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {formatTimeLabel(booking.startTime)} – {formatTimeLabel(booking.endTime || booking.startTime)}
                              {" · "}{booking.resource?.name || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <StatusBadge status={booking.status} />
                          <span className="text-xs font-medium text-amber-700">{formatCurrency(booking.dpAmount)}</span>
                          <button
                            onClick={() => void openDetail(booking.id)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Detail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Kanan: Info sidebar */}
            <div className="space-y-3">

              {/* Info store */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">INFO STORE</p>
                <div className="divide-y divide-gray-50 text-xs">
                  <SideRow label="Nama" value={settings.name} />
                  <SideRow label="Jam buka" value={`${settings.bookingOpenTime} – ${settings.bookingCloseTime}`} />
                  <SideRow label="Interval slot" value={`${settings.bookingSlotMinutes} menit`} />
                  <SideRow label="Grace period" value={`${settings.bookingGraceMinutes ?? 0} menit`} />
                </div>
              </div>

              {/* Quick actions — mirip dashboard */}
              <div className="flex flex-col gap-2">
                <Link
                  href="/booking/resources"
                  className="bg-amber-700 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-amber-800 transition-colors shadow-lg"
                >
                  <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                      <rect x="2" y="2" width="5" height="5" rx="1" stroke="white" />
                      <rect x="9" y="2" width="5" height="5" rx="1" stroke="white" />
                      <rect x="2" y="9" width="5" height="5" rx="1" stroke="white" />
                      <rect x="9" y="9" width="5" height="5" rx="1" stroke="white" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Kelola Resource</p>
                    <p className="text-xs text-amber-200">Tambah / edit resource</p>
                  </div>
                </Link>

                <Link
                  href="/booking/settings"
                  className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors shadow-lg"
                >
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                      <circle cx="8" cy="8" r="2.5" stroke="#92400e" />
                      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14" stroke="#92400e" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">Pengaturan Booking</p>
                    <p className="text-[10px] text-gray-400">Jam buka, slot, dll</p>
                  </div>
                </Link>

                <Link
                  href={publicBookingHref}
                  target="_blank"
                  className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 transition-colors shadow-lg"
                >
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
                      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="#92400e" strokeLinecap="round" />
                      <path d="M9 2h5v5M14 2L8 8" stroke="#92400e" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">Halaman Publik</p>
                    <p className="text-[10px] text-gray-400">Buka link booking customer</p>
                  </div>
                </Link>
              </div>

              {/* Booking breakdown by status */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
                <p className="text-xs font-medium text-gray-400 tracking-wider mb-3">STATUS BREAKDOWN</p>
                {(["PENDING", "CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const).map((s) => {
                  const count = bookings.filter((b) => b.status === s).length;
                  const pct = bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-4 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      {detail ? (
        <BookingDetailDrawer
          booking={detail}
          updating={updating}
          onClose={() => setDetail(null)}
          onUpdate={updateDetail}
        />
      ) : null}
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-800">{value}</span>
    </div>
  );
}

function ScheduleBoard({
  resources,
  bookings,
  openTime,
  closeTime,
  slotMinutes,
  selectedDate,
  onSelectBooking,
}: {
  resources: BookingScheduleResponse["resources"];
  bookings: BookingListItem[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  selectedDate: string;
  onSelectBooking: (id: string) => void;
}) {
  const toMinutes = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };
  const fromMinutes = (v: number) => {
    const h = Math.floor(v / 60).toString().padStart(2, "0");
    const m = (v % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const slots: string[] = [];
  for (let m = start; m < end; m += slotMinutes) slots.push(fromMinutes(m));

  const now = new Date();
  const isToday = selectedDate === todayInJakarta();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const cellWidth = 80;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <div style={{ minWidth: 180 + slots.length * cellWidth }}>
        {/* Header row */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          <div className="w-44 shrink-0 border-r border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Resource
          </div>
          {slots.map((slot) => {
            const isPast = isToday && toMinutes(slot) < currentMinute;
            return (
              <div
                key={slot}
                style={{ width: cellWidth }}
                className={`shrink-0 border-r border-gray-100 px-2 py-2 text-center text-[10px] font-medium ${
                  isPast ? "bg-gray-100 text-gray-300" : "text-gray-500"
                }`}
              >
                {slot}
              </div>
            );
          })}
        </div>

        {resources.map((resource) => {
          const rb = bookings.filter((b) => b.resource?.id === resource.id);
          return (
            <div key={resource.id} className="flex border-b border-gray-50 last:border-b-0">
              <div className="w-44 shrink-0 border-r border-gray-100 bg-white px-3 py-3">
                <p className="text-xs font-semibold text-gray-900">{resource.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {RESOURCE_TYPE_LABEL[resource.type]}{resource.capacity ? ` · ${resource.capacity} org` : ""}
                </p>
              </div>
              <div className="relative min-h-20 flex-1 bg-white" style={{ width: slots.length * cellWidth }}>
                {slots.map((slot, i) => (
                  <div
                    key={`${resource.id}-${slot}`}
                    style={{ left: i * cellWidth, width: cellWidth }}
                    className="absolute inset-y-0 border-r border-gray-50"
                  />
                ))}
                {rb.map((booking) => {
                  const bStart = toMinutes(booking.startTime);
                  const bEnd = toMinutes(booking.endTime || booking.startTime) || bStart + slotMinutes;
                  const left = ((bStart - start) / slotMinutes) * cellWidth;
                  const width = Math.max(
                    ((Math.max(bEnd, bStart + slotMinutes) - bStart) / slotMinutes) * cellWidth - 4,
                    cellWidth - 4
                  );
                  const tone =
                    booking.status === "NO_SHOW"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : booking.status === "COMPLETED"
                        ? "border-gray-200 bg-gray-100 text-gray-600"
                        : booking.source === "ONLINE"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-blue-200 bg-blue-50 text-blue-800";

                  return (
                    <button
                      key={booking.id}
                      onClick={() => onSelectBooking(booking.id)}
                      style={{ left: left + 2, width, top: 8, bottom: 8 }}
                      className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left transition hover:shadow-md ${tone}`}
                    >
                      <p className="truncate text-[10px] font-semibold">{booking.customerName}</p>
                      <p className="mt-0.5 truncate text-[9px] opacity-70">
                        {formatTimeLabel(booking.startTime)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingDetailDrawer({
  booking,
  updating,
  onClose,
  onUpdate,
}: {
  booking: BookingListItem;
  updating: boolean;
  onClose: () => void;
  onUpdate: (payload: { status?: string; dpStatus?: string }) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 backdrop-blur-sm">
      <button className="flex-1" onClick={onClose} aria-label="Tutup" />
      <aside className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-gray-100 bg-white shadow-2xl">

        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-gray-400 tracking-wider">DETAIL BOOKING</p>
            <p className="mt-1 text-xs text-gray-400 font-mono">{booking.id.slice(0, 16)}…</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Tutup
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">

          {/* Customer info */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">{booking.customerName}</p>
            <p className="mt-0.5 text-xs text-gray-500">{booking.customerPhone}</p>
            {booking.customerNote && (
              <p className="mt-2 text-xs text-gray-500 border-t border-gray-200 pt-2">{booking.customerNote}</p>
            )}
          </div>

          {/* Info grid — mirip metric cards dashboard */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Tanggal", value: formatDateLabel(booking.bookingDate.slice(0, 10)) },
              { label: "Jam", value: `${formatTimeLabel(booking.startTime)} – ${formatTimeLabel(booking.endTime || booking.startTime)}` },
              { label: "Resource", value: booking.resource?.name || "-" },
              { label: "Sumber", value: booking.source },
              { label: "DP", value: formatCurrency(booking.dpAmount) },
              { label: "Pax", value: booking.pax ? String(booking.pax) : "-" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 text-xs font-semibold text-gray-900 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.dpStatus} type="payment" />
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-medium text-gray-400 tracking-wider mb-2">ITEM BOOKING</p>
            {booking.items.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada item tercatat.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {booking.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{item.name}</p>
                      <p className="text-[10px] text-gray-400">Qty {item.qty}</p>
                    </div>
                    <p className="text-xs font-semibold text-amber-700">{formatCurrency(item.unitPrice * item.qty)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Update status booking */}
          <div>
            <p className="text-xs font-medium text-gray-400 tracking-wider mb-2">UPDATE STATUS BOOKING</p>
            <div className="grid grid-cols-2 gap-2">
              {(["CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const).map((value) => (
                <button
                  key={value}
                  disabled={updating || booking.status === value}
                  onClick={() => void onUpdate({ status: value })}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    booking.status === value
                      ? "bg-amber-700 text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {BOOKING_STATUS_META[value]?.label ?? value}
                </button>
              ))}
            </div>
          </div>

          {/* Update status DP */}
          <div>
            <p className="text-xs font-medium text-gray-400 tracking-wider mb-2">UPDATE STATUS DP</p>
            <div className="grid grid-cols-3 gap-2">
              {(["PAID", "WAIVED", "FORFEITED"] as const).map((value) => (
                <button
                  key={value}
                  disabled={updating || booking.dpStatus === value}
                  onClick={() => void onUpdate({ dpStatus: value })}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    booking.dpStatus === value
                      ? "bg-amber-700 text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
