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
  MetricCard,
  SectionCard,
  StatusBadge,
} from "@/components/booking/ui";

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const;

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
    if (!ready) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, ready, status]);

  const metrics = useMemo(() => {
    const source = schedule?.bookings ?? bookings;
    const totalRevenue = source
      .filter((booking) => booking.dpStatus === "PAID")
      .reduce((sum, booking) => sum + booking.dpAmount, 0);
    const todayBookings = source.filter((booking) => booking.status !== "NO_SHOW").length;
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
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <LoadingState label="Memuat booking dashboard..." />
      </div>
    );
  }

  if (!ready || !settings || !schedule) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {error ? (
          <ErrorState description={error} retry={() => void load()} />
        ) : (
          <EmptyState
            title="Store booking belum siap"
            description="Pastikan store aktif dan pengaturan booking sudah tersedia."
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm text-slate-500">Booking Dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{settings.name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Monitor booking harian, cek jadwal per resource, dan update status customer dari satu halaman.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/book/${settings.slug}`}
              target="_blank"
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Buka halaman public
            </Link>
            <Link
              href="/booking/resources"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Kelola resource
            </Link>
            <Link
              href="/booking/settings"
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Pengaturan booking
            </Link>
          </div>
        </div>

        {error ? <ErrorState description={error} retry={() => void load()} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total booking"
            value={metrics.totalBookings}
            hint={`Untuk ${formatDateLabel(selectedDate, { day: "numeric", month: "long", year: "numeric" })}`}
          />
          <MetricCard label="Booking aktif" value={metrics.todayBookings} hint="Tidak termasuk no-show" />
          <MetricCard label="Revenue DP" value={formatCurrency(metrics.totalRevenue)} hint="Akumulasi DP berstatus PAID" />
          <MetricCard label="Occupancy rate" value={`${metrics.occupancyRate}%`} hint="Pendekatan per resource aktif" />
        </div>

        <SectionCard title="Filter Booking" description="Pilih tanggal dan status untuk memfokuskan data admin.">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setSelectedDate((current) => shiftDate(current, -1))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Hari sebelumnya
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
              <button
                onClick={() => setSelectedDate((current) => shiftDate(current, 1))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Hari berikutnya
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item}
                  onClick={() => setSelectedStatus(item)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedStatus === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item === "ALL" ? "Semua status" : BOOKING_STATUS_META[item]?.label ?? item}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Schedule Board" description="Grid waktu vs resource untuk melihat slot yang sudah terisi.">
          {schedule.resources.length === 0 ? (
            <EmptyState
              title="Belum ada resource aktif"
              description="Tambahkan resource aktif agar jadwal booking dapat ditampilkan di board."
              action={
                <Link
                  href="/booking/resources"
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
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
        </SectionCard>

        <SectionCard title="Admin Booking List" description="Ringkasan customer, resource, dan status booking.">
          {bookings.length === 0 ? (
            <EmptyState title="Tidak ada booking" description="Belum ada booking yang cocok dengan filter saat ini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Tanggal</th>
                    <th className="py-3 pr-4">Resource</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">DP</th>
                    <th className="py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="py-4 pr-4">
                        <p className="text-sm font-semibold text-slate-950">{booking.customerName}</p>
                        <p className="mt-1 text-xs text-slate-500">{booking.customerPhone}</p>
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-700">
                        <p>
                          {formatDateLabel(booking.bookingDate.slice(0, 10), {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTimeLabel(booking.startTime)} - {formatTimeLabel(booking.endTime || booking.startTime)}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-700">{booking.resource?.name || "-"}</td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={booking.dpStatus} type="payment" />
                        <p className="mt-1 text-xs text-slate-500">{formatCurrency(booking.dpAmount)}</p>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => void openDetail(booking.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Lihat detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
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
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };

  const fromMinutes = (value: number) => {
    const hour = Math.floor(value / 60).toString().padStart(2, "0");
    const minute = (value % 60).toString().padStart(2, "0");
    return `${hour}:${minute}`;
  };

  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const slots: string[] = [];
  for (let minute = start; minute < end; minute += slotMinutes) {
    slots.push(fromMinutes(minute));
  }

  const now = new Date();
  const isToday = selectedDate === todayInJakarta();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const cellWidth = 88;

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200">
      <div style={{ minWidth: 220 + slots.length * cellWidth }}>
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className="w-56 shrink-0 border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resource
          </div>
          {slots.map((slot) => {
            const minute = toMinutes(slot);
            const isPast = isToday && minute < currentMinute;

            return (
              <div
                key={slot}
                style={{ width: cellWidth }}
                className={`shrink-0 border-r border-slate-200 px-3 py-3 text-center text-xs font-medium ${
                  isPast ? "bg-slate-100 text-slate-400" : "text-slate-600"
                }`}
              >
                {slot}
              </div>
            );
          })}
        </div>

        {resources.map((resource) => {
          const resourceBookings = bookings.filter((booking) => booking.resource?.id === resource.id);

          return (
            <div key={resource.id} className="flex border-b border-slate-100 last:border-b-0">
              <div className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">{resource.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {RESOURCE_TYPE_LABEL[resource.type]} {resource.capacity ? `• ${resource.capacity} orang` : ""}
                </p>
              </div>

              <div className="relative min-h-24 flex-1 bg-white" style={{ width: slots.length * cellWidth }}>
                {slots.map((slot, index) => (
                  <div
                    key={`${resource.id}-${slot}`}
                    style={{ left: index * cellWidth, width: cellWidth }}
                    className="absolute inset-y-0 border-r border-slate-100"
                  />
                ))}

                {resourceBookings.map((booking) => {
                  const bookingStart = toMinutes(booking.startTime);
                  const bookingEnd = toMinutes(booking.endTime || booking.startTime) || bookingStart + slotMinutes;
                  const left = ((bookingStart - start) / slotMinutes) * cellWidth;
                  const width = Math.max(((Math.max(bookingEnd, bookingStart + slotMinutes) - bookingStart) / slotMinutes) * cellWidth - 6, cellWidth - 6);
                  const tone =
                    booking.status === "NO_SHOW"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : booking.status === "COMPLETED"
                        ? "border-slate-200 bg-slate-100 text-slate-700"
                        : booking.source === "ONLINE"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-amber-200 bg-amber-50 text-amber-700";

                  return (
                    <button
                      key={booking.id}
                      onClick={() => onSelectBooking(booking.id)}
                      style={{ left: left + 3, width, top: 10, bottom: 10 }}
                      className={`absolute overflow-hidden rounded-2xl border px-3 py-2 text-left transition hover:shadow ${tone}`}
                    >
                      <p className="truncate text-xs font-semibold">{booking.customerName}</p>
                      <p className="mt-1 truncate text-[11px] opacity-80">
                        {formatTimeLabel(booking.startTime)} • {booking.items.map((item) => item.name).join(", ")}
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
      <button className="flex-1" onClick={onClose} aria-label="Tutup detail booking" />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Detail Booking</h2>
            <p className="mt-1 text-sm text-slate-500">{booking.id}</p>
          </div>
          <button onClick={onClose} className="text-sm font-medium text-slate-500 transition hover:text-slate-900">
            Tutup
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">{booking.customerName}</p>
            <p className="mt-1 text-sm text-slate-500">{booking.customerPhone}</p>
            {booking.customerNote ? <p className="mt-3 text-sm text-slate-600">{booking.customerNote}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoPair label="Tanggal" value={formatDateLabel(booking.bookingDate.slice(0, 10))} />
            <InfoPair
              label="Jam"
              value={`${formatTimeLabel(booking.startTime)} - ${formatTimeLabel(booking.endTime || booking.startTime)}`}
            />
            <InfoPair label="Resource" value={booking.resource?.name || "-"} />
            <InfoPair label="Sumber" value={booking.source} />
            <InfoPair label="DP" value={formatCurrency(booking.dpAmount)} />
            <InfoPair label="Pax" value={booking.pax ? String(booking.pax) : "-"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.dpStatus} type="payment" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Item booking</p>
            {booking.items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Belum ada item tercatat.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {booking.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Qty {item.qty}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.unitPrice * item.qty)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Update status booking</p>
              <div className="grid grid-cols-2 gap-2">
                {(["CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"] as const).map((value) => (
                  <button
                    key={value}
                    disabled={updating || booking.status === value}
                    onClick={() => void onUpdate({ status: value })}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      booking.status === value
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {BOOKING_STATUS_META[value]?.label ?? value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Update status DP</p>
              <div className="grid grid-cols-3 gap-2">
                {(["PAID", "WAIVED", "FORFEITED"] as const).map((value) => (
                  <button
                    key={value}
                    disabled={updating || booking.dpStatus === value}
                    onClick={() => void onUpdate({ dpStatus: value })}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      booking.dpStatus === value
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
