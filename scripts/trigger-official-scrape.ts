/**
 * Trigger official engagement scrape + apply computed scores to DB.
 * Run with: node --import tsx/esm scripts/trigger-official-scrape.ts
 */
import "dotenv/config";
import { scrapeOfficialAccountEngagement } from "../server/apifyPipeline";
import { recalculateAllXP } from "../server/xpEngine";

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || process.env.APP_BASE_URL ?? "https://your-app.example.com";
const PROGRAM_START_DATE = "2026-03-06";

async function main() {
  console.log("=== Step 1: Trigger official engagement scrape (from program start) ===");
  try {
    const result = await scrapeOfficialAccountEngagement(WEBHOOK_BASE_URL, PROGRAM_START_DATE);
    console.log(`Official engagement scrape started: jobId=${result.jobId}, runs=${result.runsStarted}`);
    console.log("Apify runs are async — results will arrive via webhook over the next few minutes.");
  } catch (err) {
    console.error("Official engagement scrape failed:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 2: Recalculate all XP scores with current data ===");
  try {
    const count = await recalculateAllXP();
    console.log(`Recalculated XP for ${count} ambassadors.`);
  } catch (err) {
    console.error("Recalculate failed:", err instanceof Error ? err.message : err);
  }

  console.log("\nDone. Official engagement data will continue arriving via webhook as Apify completes.");
  process.exit(0);
}

main();
