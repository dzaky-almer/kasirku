// scripts/set-plan.mjs
// Contoh:
// node --env-file=.env scripts/set-plan.mjs set --email user@example.com --plan PRO --days 30
// node --env-file=.env scripts/set-plan.mjs set --store STORE_ID --plan ULTRA --days 90
// node --env-file=.env scripts/set-plan.mjs set --email user@example.com --plan BASIC

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const VALID_PLANS = new Set(["BASIC", "PRO", "ULTRA"]);

function printUsage() {
  console.log(`
KasirKu Plan Tool

Perintah:
  set --email <email> --plan <BASIC|PRO|ULTRA> [--days <jumlahHari>]
  set --store <storeId> --plan <BASIC|PRO|ULTRA> [--days <jumlahHari>]
    Mengubah plan store berdasarkan email owner atau storeId.

Catatan:
  - Untuk plan BASIC, expiry akan dihapus.
  - Untuk plan PRO / ULTRA, default expiry = 30 hari jika --days tidak diisi.
  - Setelah update plan, user perlu logout-login lagi agar session mengambil plan terbaru.

Contoh:
  node --env-file=.env scripts/set-plan.mjs set --email user@tokoku.id --plan PRO --days 30
  node --env-file=.env scripts/set-plan.mjs set --store 123e4567-e89b-12d3-a456-426614174000 --plan ULTRA --days 90
  node --env-file=.env scripts/set-plan.mjs set --email basic@tokoku.id --plan BASIC
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[index + 1];
    flags[key] = value;
    index += 1;
  }

  return { command, flags };
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function resolvePlanExpiry(plan, daysRaw) {
  if (plan === "BASIC") return "NULL";

  const days = Number(daysRaw ?? 30);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Nilai --days harus angka lebih dari 0 untuk plan PRO/ULTRA.");
  }

  return `(NOW() + INTERVAL '${days} days')`;
}

function runSql(sql) {
  const tempDir = join(tmpdir(), "kasirku-plan-tool");
  mkdirSync(tempDir, { recursive: true });
  const sqlFile = join(tempDir, `set-plan-${Date.now()}.sql`);
  writeFileSync(sqlFile, sql, "utf8");

  try {
    execFileSync("cmd", ["/c", "npx", "prisma", "db", "execute", "--file", sqlFile], {
      stdio: "inherit",
      env: {
        ...process.env,
      },
    });
  } finally {
    rmSync(sqlFile, { force: true });
  }
}

function buildUpdateSql({ email, storeId, plan, expirySql }) {
  const targetStoreSql = storeId
    ? `
      SELECT s.id
      FROM "Store" s
      WHERE s.id = ${sqlString(storeId)}
      LIMIT 1
    `
    : `
      SELECT s.id
      FROM "Store" s
      JOIN "User" u ON u.id = s."userId"
      WHERE LOWER(u.email) = LOWER(${sqlString(email)})
      ORDER BY s."createdAt" ASC
      LIMIT 1
    `;

  return `
WITH target_store AS (
  ${targetStoreSql}
)
UPDATE "Store"
SET plan = ${sqlString(plan)}::"Plan",
    "planExpiresAt" = ${expirySql}
WHERE id IN (SELECT id FROM target_store);
`;
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command !== "set") {
    throw new Error(`Perintah tidak dikenali: ${command}. Saat ini tool mendukung perintah 'set'.`);
  }

  const email = flags.email?.trim();
  const storeId = flags.store?.trim();
  const plan = flags.plan?.trim().toUpperCase();

  if (!email && !storeId) {
    throw new Error("Gunakan --email atau --store.");
  }

  if (email && storeId) {
    throw new Error("Pilih salah satu: --email atau --store.");
  }

  if (!VALID_PLANS.has(plan)) {
    throw new Error("Gunakan --plan BASIC, PRO, atau ULTRA.");
  }

  const expirySql = resolvePlanExpiry(plan, flags.days);
  const sql = buildUpdateSql({ email, storeId, plan, expirySql });

  console.log("\nMenjalankan update plan...\n");
  runSql(sql);

  console.log("\nSelesai.");
  console.log(`Target      : ${email ? `email ${email}` : `store ${storeId}`}`);
  console.log(`Plan        : ${plan}`);
  console.log(`Expired At  : ${plan === "BASIC" ? "NULL" : `${flags.days ?? 30} hari dari sekarang`}`);
  console.log("\nLogin ulang user tersebut agar session mengambil plan terbaru.");
}

main().catch((error) => {
  console.error(`\nError: ${error.message}\n`);
  printUsage();
  process.exit(1);
});
