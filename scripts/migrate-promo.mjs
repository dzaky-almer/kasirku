// scripts/migrate-promo.mjs
// Jalankan: node --env-file=.env scripts/migrate-promo.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Mulai migrasi data promo lama → PromoRule...\n");

  // Ambil semua promo yang belum punya rules
  const promos = await prisma.promo.findMany({
    where: { rules: { none: {} } },
    select: { id: true, name: true },
  });

  console.log(`📦 Ditemukan ${promos.length} promo tanpa rules\n`);

  if (promos.length === 0) {
    console.log("✅ Semua promo sudah punya rules, tidak perlu migrasi.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const promo of promos) {
    try {
      // Buat 1 PromoRule default (PRODUCT, PERCENT, 0%)
      // Nanti bisa diedit manual lewat halaman admin
      await prisma.promoRule.create({
        data: {
          promoId: promo.id,
          order: 0,
          type: "PRODUCT",
          discountType: "PERCENT",
          discountValue: 0,
          productId: null,
          startTime: null,
          endTime: null,
          minTransaction: null,
        },
      });

      console.log(`  ✅ "${promo.name}" — rule default dibuat (edit manual di admin)`);
      success++;
    } catch (err) {
      console.error(`  ❌ "${promo.name}" gagal:`, err.message);
      failed++;
    }
  }

  console.log(`\n──────────────────────────────`);
  console.log(`✅ Berhasil : ${success}`);
  console.log(`❌ Gagal    : ${failed}`);
  console.log(`──────────────────────────────`);
  console.log("🎉 Selesai! Edit detail promo lewat halaman admin.");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
