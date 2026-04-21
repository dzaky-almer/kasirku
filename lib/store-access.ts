import { prisma } from "@/lib/prisma";

export async function canAccessStore(storeId: string, userId?: string | null) {
  if (!userId) return null;

  return prisma.store.findFirst({
    where: {
      id: storeId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      type: true,
      bookingGraceMinutes: true,
      bookingOpenTime: true,
      bookingCloseTime: true,
      bookingSlotMinutes: true,
    },
  });
}
