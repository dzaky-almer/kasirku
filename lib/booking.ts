import { prisma } from "@/lib/prisma";

export const BARBER_BUFFER_MINUTES = 10;

export type BookingBusinessType = "BARBER" | "CAFE";

export function normalizeBusinessType(storeType: string) {
  return storeType.toLowerCase().includes("barber") ? "BARBER" : "CAFE";
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function generateBookingSlots(openTime: string, closeTime: string, slotMinutes: number) {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  const safeSlot = Math.min(Math.max(slotMinutes || 30, 5), 180);
  const slots: string[] = [];

  for (let current = open; current + safeSlot <= close; current += safeSlot) {
    slots.push(minutesToTime(current));
  }

  return slots;
}

export function bookingTimeOverlaps(startA: string, durationA: number, startB: string, durationB: number) {
  const aStart = timeToMinutes(startA);
  const aEnd = aStart + durationA;
  const bStart = timeToMinutes(startB);
  const bEnd = bStart + durationB;

  return aStart < bEnd && bStart < aEnd;
}

export function resolveBookingDurationMinutes(
  type: BookingBusinessType,
  fallbackSlotMinutes: number,
  items?: Array<{ durationMin?: number | null }>
) {
  if (type === "BARBER") {
    const total = (items ?? []).reduce((sum, item) => sum + (item.durationMin ?? 0), 0);
    return total > 0 ? total : fallbackSlotMinutes;
  }

  return fallbackSlotMinutes;
}

export function resolveOperationalBookingDurationMinutes(
  type: BookingBusinessType,
  fallbackSlotMinutes: number,
  items?: Array<{ durationMin?: number | null }>
) {
  const baseDuration = resolveBookingDurationMinutes(type, fallbackSlotMinutes, items);
  return type === "BARBER" ? baseDuration + BARBER_BUFFER_MINUTES : baseDuration;
}

function getBookingExpiryDate(bookingDate: Date, startTime: string, graceMinutes: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const base = new Date(bookingDate);
  base.setHours(hours, minutes, 0, 0);
  return new Date(base.getTime() + graceMinutes * 60 * 1000);
}

export async function syncOverdueBookings(storeId: string, graceMinutes = 30) {
  const candidates = await prisma.booking.findMany({
    where: {
      storeId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      id: true,
      bookingDate: true,
      startTime: true,
      dpAmount: true,
    },
  });

  const now = new Date();
  const overdueBookings = candidates.filter(
    (booking) => getBookingExpiryDate(booking.bookingDate, booking.startTime, graceMinutes) <= now
  );

  if (overdueBookings.length === 0) return 0;

  await Promise.all(
    overdueBookings.map((booking) =>
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "NO_SHOW",
          dpStatus: booking.dpAmount > 0 ? "FORFEITED" : "WAIVED",
          noShowAt: now,
        },
      })
    )
  );

  return overdueBookings.length;
}

export function bookingSourceTone(source: string) {
  return source === "OFFLINE" ? "OFFLINE" : "ONLINE";
}
