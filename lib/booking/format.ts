const APP_TIME_ZONE = "Asia/Jakarta";

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  BARBER: "Kursi",
  TABLE: "Meja",
  AREA: "Area",
  ROOM: "Ruangan",
};

export const BOOKING_STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Menunggu", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  CONFIRMED: { label: "Terkonfirmasi", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  ARRIVED: { label: "Datang", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  COMPLETED: { label: "Selesai", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  NO_SHOW: { label: "No Show", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const BOOKING_DP_STATUS_META: Record<string, { label: string; tone: string }> = {
  UNPAID: { label: "Belum Bayar", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  PAID: { label: "Lunas", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  WAIVED: { label: "Gratis", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  FAILED: { label: "Gagal", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  FORFEITED: { label: "Hangus", tone: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTimeLabel(value: string) {
  return value.slice(0, 5);
}

export function formatDateLabel(value: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildTimeSlots(openTime: string, closeTime: string, interval: number) {
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

  for (let minute = start; minute < end; minute += interval) {
    slots.push(fromMinutes(minute));
  }

  return slots;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}
