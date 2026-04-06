import { PrismaClient } from "../lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const hashed = await bcrypt.hash("password123", 10);

  const user = await prisma.user.create({
    data: {
      email: "admin@kopinusantara.com",
      password: hashed,
      stores: {
        create: {
          name: "Kopi Nusantara",
          type: "cafe",
        },
      },
    },
  });

  console.log("✅ User dibuat:", user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());