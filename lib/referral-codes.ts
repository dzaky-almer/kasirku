import { Pool } from "pg";

type ReferralCodeRow = {
  id: string;
  code: string;
  plan: string;
  tier: string;
  durationDays: number;
  expiresAt: Date | null;
  isActive: boolean;
  isUsed: boolean;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdAt: Date;
};

const globalForReferralPool = globalThis as unknown as {
  referralPool?: Pool;
};

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL atau DIRECT_URL wajib diisi.");
}

const referralPool =
  globalForReferralPool.referralPool ??
  new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForReferralPool.referralPool = referralPool;
}

function mapReferralCode(row: ReferralCodeRow) {
  return {
    id: row.id,
    code: row.code,
    plan: row.plan,
    tier: row.tier,
    durationDays: row.durationDays,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    isUsed: row.isUsed,
    usedAt: row.usedAt,
    usedByUserId: row.usedByUserId,
    createdAt: row.createdAt,
  };
}

export async function findReferralCodeByCode(code: string) {
  const result = await referralPool.query<ReferralCodeRow>(
    `
      SELECT
        id,
        code,
        plan,
        tier,
        "durationDays",
        "expiresAt",
        "isActive",
        "isUsed",
        "usedAt",
        "usedByUserId",
        "createdAt"
      FROM "ReferralCode"
      WHERE code = $1
      LIMIT 1
    `,
    [code]
  );

  return result.rows[0] ? mapReferralCode(result.rows[0]) : null;
}

export async function listUnusedReferralCodes(limit = 100) {
  const result = await referralPool.query<ReferralCodeRow>(
    `
      SELECT
        id,
        code,
        plan,
        tier,
        "durationDays",
        "expiresAt",
        "isActive",
        "isUsed",
        "usedAt",
        "usedByUserId",
        "createdAt"
      FROM "ReferralCode"
      WHERE "isActive" = TRUE
        AND "isUsed" = FALSE
      ORDER BY "createdAt" DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map(mapReferralCode);
}

export async function createReferralCode(input: {
  code: string;
  plan: string;
  tier: string;
  durationDays: number;
  expiresAt: Date | null;
}) {
  const id = crypto.randomUUID();
  const result = await referralPool.query<ReferralCodeRow>(
    `
      INSERT INTO "ReferralCode" (
        id,
        code,
        plan,
        tier,
        "durationDays",
        "expiresAt",
        "isActive",
        "isUsed",
        "createdAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        TRUE,
        FALSE,
        NOW()
      )
      RETURNING
        id,
        code,
        plan,
        tier,
        "durationDays",
        "expiresAt",
        "isActive",
        "isUsed",
        "usedAt",
        "usedByUserId",
        "createdAt"
    `,
    [id, input.code, input.plan, input.tier, input.durationDays, input.expiresAt]
  );

  return mapReferralCode(result.rows[0]);
}
