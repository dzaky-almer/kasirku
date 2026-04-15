import { prisma } from "@/lib/prisma";

export async function canAccessStore(storeId: string, userId?: string | null) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      userId: true,
      isDemo: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!store) return null;
  if (userId && store.userId === userId) return store;
  if (store.isDemo) return store;
  if (store.user.email === "user1@kopi.com") return store;

  return null;
}
