"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bookingApi } from "@/lib/booking/api";
import {
  BOOKING_STATUS_META,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  shiftDate,
  todayInJakarta,
} from "@/lib/booking/format";
import { useStoreIdentity } from "@/lib/booking/use-store-id";
import type {
  BookingListItem,
  BookingScheduleResponse,
  BookingSettingsResponse,
} from "@/lib/booking/types";
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
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  async function load() {
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
  }

  useEffect(() => {
    if (status === "loading") return;
    if (!ready) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, selectedDate, selectedStatus, status, storeId]);

  const metrics = useMemo(() => {
    const source = schedule?.bookings ?? [];
    const totalRevenue = source
      .filter((booking) => booking.dpStatus === "PAID")
      .reduce((sum, booking) => sum + booking.dpAmount, 0);
    const todayBookings = source.filter((booking) => booking.status !== "NO_SHOW").length;
    const resourceCount = schedule?.resources.length ?? 0;
    const occupancyRate =
      resourceCount > 0 ? Math.round((todayBookings / resourceCount) * 100) : 0;

    return {
      totalBookings: source.length,
      todayBookings,
      totalRevenue,
      occupancyRate,
    };
  }, [schedule]);

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
              Monitor booking harian, cek jadwal per resource, dan update status customer tanpa pindah halaman.
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
          <MetricCard label="Total booking" value={metrics.totalBookings} hint={`Untuk ${formatDateLabel(selectedDate, { day: "numeric", month: "long", year: "numeric" })}`} />
          <MetricCard label="Booking aktif hari ini" value={metrics.todayBookings} hint="Tidak termasuk no-show" />
          <MetricCard label="Revenue DP" value={formatCurrency(metrics.totalRevenue)} hint="Akumulasi DP berstatus PAID" />
          <MetricCard label="Occupancy rate" value={`${metrics.occupancyRate}%`} hint="Pendekatan per resource aktif" />
        </div>

        <SectionCard title="Filter Booking" description="Pilih tanggal dan status untuk memfokuskan list booking admin.">
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
                    selectedStatus === item
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item === "ALL" ? "Semua status" : BOOKING_STATUS_META[item]?.label ?? item}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Schedule Board" description="Grid waktu vs resource untuk melihat slot booked, kosong, dan yang sudah lewat.">
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
              bookings={schedule.bookings}
              openTime={settings.bookingOpenTime}
              closeTime={settings.bookingCloseTime}
              resources={schedule.resources}
              slotMinutes={settings.bookingSlotMinutes}
              selectedDate={selectedDate}
              onSelectBooking={openDetail}
            />
          )}
        </SectionCard>

        <SectionCard title="Admin Booking List" description="Lihat customer, resource, dan status booking secara ringkas.">
          {bookings.length === 0 ? (
            <EmptyState
              title="Tidak ada booking"
              description="Belum ada booking yang cocok dengan filter saat ini."
            />
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
                        <p>{formatDateLabel(booking.bookingDate.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}</p>
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
  resources: BookingSettingsResponse["bookingResources"];
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
  const slots = [];
  for (let minute = start; minute < end; minute += slotMinutes) {
    slots.push(fromMinutes(minute));
  }

  const now = new Date();
  const isToday = selectedDate === todayInJakarta();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const cellWidth = 88;

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200">
      <div style={{ minWidth: resources.length > 0 ? 220 + slots.length * cellWidth : "100%" }}>
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
                  {resource.type} {resource.capacity ? `· ${resource.capacity} pax` : ""}
                </p>
              </div>

              <div className="relative h-20 flex-1 bg-white">
                {slots.map((slot, index) => {
                  const minute = toMinutes(slot);
                  const isPast = isToday && minute < currentMinute;
                  return (
                    <div
                      key={`${resource.id}-${slot}`}
                      style={{ left: index * cellWidth, width: cellWidth }}
                      className={`absolute inset-y-0 border-r border-slate-100 ${
                        isPast ? "bg-slate-50" : "bg-white"
                      }`}
                    />
                  );
                })}

                {resourceBookings.map((booking) => {
                  const left = ((toMinutes(booking.startTime) - start) / slotMinutes) * cellWidth;
                  const width =
                    ((toMinutes(booking.endTime || booking.startTime) - toMinutes(booking.startTime)) / slotMinutes) *
                    cellWidth;

                  return (
                    <button
                      key={booking.id}
                      onClick={() => onSelectBooking(booking.id)}
                      style={{ left: left + 4, width: Math.max(width - 8, cellWidth - 10) }}
                      className={`absolute top-2 h-16 overflow-hidden rounded-2xl border px-3 py-2 text-left ${
                        booking.status === "NO_SHOW"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-sky-200 bg-sky-50 text-sky-800"
                      }`}
                    >
                      <p className="truncate text-xs font-semibold">{booking.customerName}</p>
                      <p className="mt-1 truncate text-[11px] opacity-80">
                        {formatTimeLabel(booking.startTime)} · {booking.items.map((item) => item.name).join(", ")}
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
      <button className="flex-1 cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Booking Detail</h2>
            <p className="mt-1 text-sm text-slate-500">{booking.id}</p>
          </div>
          <button onClick={onClose} className="text-sm font-medium text-slate-500 transition hover:text-slate-900">
            Tutup
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-semibold text-slate-950">{booking.customerName}</p>
            <p className="mt-1 text-sm text-slate-500">{booking.customerPhone}</p>
            {booking.customerNote ? <p className="mt-4 text-sm text-slate-600">{booking.customerNote}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Tanggal" value={formatDateLabel(booking.bookingDate.slice(0, 10))} />
            <DetailField label="Jam" value={`${formatTimeLabel(booking.startTime)} - ${formatTimeLabel(booking.endTime || booking.startTime)}`} />
            <DetailField label="Resource" value={booking.resource?.name || "-"} />
            <DetailField label="Pax" value={booking.pax ? `${booking.pax} orang` : "-"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.dpStatus} type="payment" />
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-950">Produk / layanan</p>
            <div className="mt-4 space-y-3">
              {booking.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {item.name} x {item.qty}
                  </span>
                  <span className="font-medium text-slate-950">{formatCurrency(item.unitPrice * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-950">
              Total DP: {formatCurrency(booking.dpAmount)}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-950">Update status</p>
            <div className="grid grid-cols-2 gap-2">
              {["CONFIRMED", "ARRIVED", "COMPLETED", "NO_SHOW"].map((item) => (
                <button
                  key={item}
                  disabled={updating}
                  onClick={() => void onUpdate({ status: item })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {BOOKING_STATUS_META[item]?.label ?? item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["PAID", "WAIVED", "FORFEITED"].map((item) => (
                <button
                  key={item}
                  disabled={updating}
                  onClick={() => void onUpdate({ dpStatus: item })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
