/**
 * Manually import official engagement datasets from Apify.
 * Run with: node --import tsx/esm scripts/import-official-datasets.ts
 *
 * Usage: populate `runs` below with the dataset IDs from your Apify run history
 * for cases where the webhook callback was missed (e.g. server was restarting).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { isNotNull } from "drizzle-orm";
import { ambassadorApplications } from "../drizzle/schema";
import { handleOfficialEngagementWebhook } from "../server/apifyPipeline";
import { recalculateAllXP } from "../server/xpEngine";

// Set to the earliest date you want to include in the import (YYYY-MM-DD)
const PROGRAM_START_DATE = process.env.PROGRAM_START_DATE ?? "2025-01-01";

// Populate with Apify dataset IDs from runs whose webhooks were missed.
// Labels are for logging only — use any descriptive string.
const runs = [
  { scrapeRunId: 90013, jobId: 90001, datasetId: "nknKHlyW9eP0WxN7d", label: "replies-to-primary-handle" },
  { scrapeRunId: 90014, jobId: 90001, datasetId: "EXAMPLE_DATASET_ID_1", label: "replies-to-secondary-handle" },
  { scrapeRunId: 90015, jobId: 90001, datasetId: "ou4ghxJkOW5k43Gg7", label: "retweets-of-primary-handle" },
  { scrapeRunId: 90016, jobId: 90001, datasetId: "EXAMPLE_DATASET_ID_2", label: "retweets-of-secondary-handle" },
  { scrapeRunId: 90017, jobId: 90001, datasetId: "acYQKVsLh1nmoUJvp", label: "posts-from-primary-handle" },
  { scrapeRunId: 90018, jobId: 90001, datasetId: "EXAMPLE_DATASET_ID_3", label: "posts-from-secondary-handle" },
];

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool);

  // Build handle → ambassadorId map from DB
  const ambassadors = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(isNotNull(ambassadorApplications.twitterHandle));

  const handleToId: Record<string, number> = {};
  for (const a of ambassadors) {
    if (a.twitterHandle) {
      handleToId[a.twitterHandle.replace(/^@/, "").toLowerCase()] = a.id;
    }
  }
  const handleMapJson = JSON.stringify(handleToId);
  console.log(`Built handle map for ${Object.keys(handleToId).length} ambassadors`);

  console.log("\n=== Importing official engagement datasets ===");

  for (const run of runs) {
    console.log(`\nImporting ${run.label} (dataset: ${run.datasetId})...`);
    try {
      await handleOfficialEngagementWebhook({
        runId: `manual-import-${run.scrapeRunId}`,
        datasetId: run.datasetId,
        status: "SUCCEEDED",
        scrapeRunId: run.scrapeRunId,
        jobId: run.jobId,
        sinceDate: PROGRAM_START_DATE,
        handleMap: handleMapJson,
      });
      console.log(`  ✓ ${run.label} imported`);
    } catch (err) {
      console.error(`  ✗ ${run.label} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n=== Recalculating XP for all ambassadors ===");
  const count = await recalculateAllXP();
  console.log(`Recalculated XP for ${count} ambassadors.`);

  console.log("\nDone.");
  await pool.end();
  process.exit(0);
}

main();
