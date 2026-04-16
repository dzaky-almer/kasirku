import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

async function main() {
  const password = await bcrypt.hash("password123", 10);

  console.log("START SEEDING FULL...");

  for (let u = 6; u <= 30; u++) {
    const user = await prisma.user.upsert({
      where: { email: `user${u}@kopi.com` },
      update: {},
      create: {
        email: `user${u}@kopi.com`,
        password,
        stores: {
          create: {
            name: `Kopi Cabang ${u}`,
            type: "cafe",
            isDemo: u === 1,
          },
        },
      },
      include: { stores: true },
    });

    const store = user.stores[0];
    await prisma.store.update({
      where: { id: store.id },
      data: {
        isDemo: u === 1,
      },
    });

    const storeId = store.id;
    const userId = user.id;

    console.log(`User ${u} siap`);

    let productList = await prisma.product.findMany({
      where: { storeId },
    });

    if (productList.length === 0) {
      const products = [];

      for (let p = 1; p <= 5; p++) {
        products.push({
          name: `Menu ${p}`,
          price: random(10000, 50000),
          stock: random(500, 1500),
          minStock: 5,
          unit: "pcs",
          storeId,
        });
      }

      await prisma.product.createMany({ data: products });

      productList = await prisma.product.findMany({
        where: { storeId },
      });

      console.log(`Produk dibuat: ${productList.length}`);
    } else {
      console.log(`Produk sudah ada: ${productList.length}`);
    }

    console.log(`Generate transaksi untuk ${store.name}...`);

    for (let d = 0; d < 5; d++) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - d);

      const dayStart = startOfDay(baseDate);
      const dayEnd = endOfDay(baseDate);

      const existingTransactions = await prisma.transaction.count({
        where: {
          storeId,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      if (existingTransactions > 0) {
        console.log(
          `${store.name} hari ke-${d} dilewati (${existingTransactions} transaksi sudah ada)`
        );
        continue;
      }

      const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
      const trxCount = isWeekend ? 80 : 50;
      const openingCash = random(150000, 500000);

      const openedAt = new Date(dayStart);
      openedAt.setHours(7, random(0, 30), 0, 0);

      const shift = await prisma.shift.create({
        data: {
          opening_cash: openingCash,
          closing_cash: openingCash,
          total_sales: 0,
          total_transactions: 0,
          status: "CLOSED",
          opened_at: openedAt,
          closed_at: dayEnd,
          notes: `Seed shift ${store.name} hari ke-${d}`,
          userId,
          cashierName: `Kasir ${u}`,
          storeId,
        },
      });

      let dailySales = 0;
      let dailyTransactions = 0;

      for (let i = 0; i < trxCount; i++) {
        const items = [...productList]
          .sort(() => 0.5 - Math.random())
          .slice(0, random(1, 4))
          .map((product) => ({
            productId: product.id,
            qty: random(1, 5),
            price: product.price,
          }));

        const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
        const createdAt = new Date(dayStart);

        const hour = Math.random() > 0.5 ? random(8, 11) : random(17, 21);
        createdAt.setHours(hour, random(0, 59), random(0, 59), random(0, 999));

        await prisma.transaction.create({
          data: {
            storeId,
            total,
            shiftId: shift.id,
            paymentMethod: Math.random() > 0.35 ? "cash" : "qris",
            createdAt,
            items: {
              create: items,
            },
          },
        });

        dailySales += total;
        dailyTransactions += 1;
      }

      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          total_sales: dailySales,
          total_transactions: dailyTransactions,
          closing_cash: openingCash + dailySales,
        },
      });

      console.log(`${store.name} hari ke-${d} selesai`);
    }
  }

  console.log("SEEDING SELESAI");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
