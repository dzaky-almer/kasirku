import "dotenv/config";
import pg from "pg";

const { Client } = pg;

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DIRECT_URL atau DATABASE_URL belum diatur.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const preview = await client.query(`
      SELECT
        u.email,
        s.id AS "storeId",
        s.name AS "storeName",
        s.plan AS "storePlan",
        s."planExpiresAt" AS "storePlanExpiresAt",
        sub.plan AS "subscriptionPlan",
        sub.tier,
        sub."expiredAt" AS "subscriptionExpiredAt",
        sub.status
      FROM "Subscription" sub
      JOIN "User" u ON u.id = sub."userId"
      JOIN "Store" s ON s."userId" = u.id
      ORDER BY sub."startDate" ASC
    `);

    console.log(`Target akun lama: ${preview.rowCount}`);
    if (preview.rowCount > 0) {
      console.table(
        preview.rows.map((row) => ({
          email: row.email,
          store: row.storeName,
          storePlan: row.storePlan,
          subscriptionPlan: row.subscriptionPlan,
          expiredAt: row.subscriptionExpiredAt,
          status: row.status,
        }))
      );
    }

    if (dryRun) {
      console.log("Dry run selesai. Tidak ada perubahan yang disimpan.");
      return;
    }

    await client.query("BEGIN");

    const storeResult = await client.query(`
      UPDATE "Store" s
      SET plan = 'ULTRA'::"Plan",
          "planExpiresAt" = COALESCE(sub."expiredAt", s."planExpiresAt")
      FROM "Subscription" sub
      WHERE sub."userId" = s."userId"
    `);

    const subscriptionResult = await client.query(`
      UPDATE "Subscription"
      SET plan = 'ULTRA',
          status = CASE
            WHEN "expiredAt" >= NOW() THEN 'active'
            ELSE status
          END
    `);

    await client.query("COMMIT");

    console.log(`Store yang diupdate       : ${storeResult.rowCount}`);
    console.log(`Subscription yang diupdate: ${subscriptionResult.rowCount}`);
    console.log("Semua akun lama yang punya subscription sekarang diset ke ULTRA.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Gagal upgrade akun lama ke ULTRA.");
  console.error(error);
  process.exit(1);
});
