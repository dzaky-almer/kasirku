import { prisma } from "@/lib/prisma";

export function slugifyStoreName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "store";
}

export async function generateUniqueStoreSlug(name: string) {
  const base = slugifyStoreName(name);

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.store.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  return `${base}-${Date.now()}`;
}
