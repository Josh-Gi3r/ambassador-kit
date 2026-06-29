// Recalculate badges for all ambassadors with level >= 1
// Run: pnpm tsx scripts/recalc-badges.ts

import "dotenv/config";
import { getDb } from "../server/db";
import { ambassadorApplications } from "../drizzle/schema";
import { gte } from "drizzle-orm";
import { computeBadgesForAmbassador } from "../server/badgeEngine";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");

  const rows = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(gte(ambassadorApplications.level, 1));

  console.log(`Found ${rows.length} ambassadors with level >= 1. Recalculating badges...`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await computeBadgesForAmbassador(row.id);
      console.log(`✓ id=${row.id} @${row.twitterHandle}`);
      success++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ id=${row.id} @${row.twitterHandle}: ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
