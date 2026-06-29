/**
 * Scheduled tasks for the Ambassador platform.
 * SCRAPING_SPEC_VERSION: 6.0
 *
 * Daily scrape: 06:00 SGT (22:00 UTC)
 *   Pipeline 1 — scrapeAllAmbassadorsX: ambassador's own protocol posts/replies/quotes
 *   Pipeline 2 — scrapeOfficialEngagement: ambassador engagement on @YOUR_OFFICIAL_HANDLE posts
 *   Pipeline 3 — scrapeConversationThreads: ambassador engagement in protocol conversation threads
 *   XP recalculation runs automatically at the end of each pipeline (wired inside xScraper.ts)
 *
 * Weekly full-cohort scrape: Sunday 00:00 SGT (Saturday 16:00 UTC)
 *   Same as daily but forces scrape from PROGRAM_START_DATE for full history coverage.
 *
 * Uses xScraper.ts functions — NOT apifyPipeline.ts (dead code, do not use).
 */

import cron from "node-cron";
import { scrapeAllAmbassadorsX, scrapeOfficialEngagement, scrapeConversationThreads } from "./xScraper";

// Program start date — used as the floor for full-cohort scrapes
const PROGRAM_START_DATE = "2026-03-06";

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // ── Daily scrape ─────────────────────────────────────────────────────────────
  // 06:00 SGT = 22:00 UTC (previous calendar day)
  cron.schedule("0 0 22 * * *", async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Daily scrape starting at ${now} (06:00 SGT)`);

    // Pipeline 1: ambassador outward (their own protocol posts)
    try {
      const { jobId, total } = await scrapeAllAmbassadorsX();
      console.log(`[Scheduler] P1 started: jobId=${jobId}, ambassadors=${total}`);
    } catch (err) {
      console.error("[Scheduler] P1 failed:", err instanceof Error ? err.message : err);
    }

    // Pipeline 2: official engagement (ambassador replies/quotes on @YOUR_OFFICIAL_HANDLE posts)
    try {
      const { postIdsFound, totalImported } = await scrapeOfficialEngagement();
      console.log(`[Scheduler] P2 done: postIdsFound=${postIdsFound}, imported=${totalImported}`);
    } catch (err) {
      console.error("[Scheduler] P2 failed:", err instanceof Error ? err.message : err);
    }

    // Pipeline 3: conversation threads (ambassador engagement in protocol threads)
    try {
      const { mentionPostsFound, totalImported } = await scrapeConversationThreads();
      console.log(`[Scheduler] P3 done: mentionPostsFound=${mentionPostsFound}, imported=${totalImported}`);
    } catch (err) {
      console.error("[Scheduler] P3 failed:", err instanceof Error ? err.message : err);
    }

    // Build Bible v1.2 Part 7 — new ledger cron runs AFTER the scrapers.
    try {
      const { runLedgerDailyCron } = await import("./ledgerCron");
      const r = await runLedgerDailyCron();
      console.log(
        `[Scheduler] Ledger cron: ${r.ambassadors} ambassadors, +${r.promoted} promoted, -${r.steppedDown} stepped down, founding closed=${r.founding.closed}`,
      );
    } catch (err) {
      console.error("[Scheduler] Ledger cron failed:", err instanceof Error ? err.message : err);
    }

    console.log(`[Scheduler] Daily scrape complete at ${new Date().toISOString()}`);
  });

  // ── Weekly full-cohort scrape ────────────────────────────────────────────────
  // Sunday 00:00 SGT = Saturday 16:00 UTC
  // Forces scrape from PROGRAM_START_DATE so full history is covered
  cron.schedule("0 0 16 * * 6", async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Weekly full-cohort scrape starting at ${now} (Sunday 00:00 SGT)`);

    // Pipeline 1: full history from program start
    try {
      const { jobId, total } = await scrapeAllAmbassadorsX(PROGRAM_START_DATE);
      console.log(`[Scheduler] Weekly P1 started: jobId=${jobId}, ambassadors=${total}`);
    } catch (err) {
      console.error("[Scheduler] Weekly P1 failed:", err instanceof Error ? err.message : err);
    }

    // Pipeline 2: full history from program start
    try {
      const { postIdsFound, totalImported } = await scrapeOfficialEngagement(PROGRAM_START_DATE);
      console.log(`[Scheduler] Weekly P2 done: postIdsFound=${postIdsFound}, imported=${totalImported}`);
    } catch (err) {
      console.error("[Scheduler] Weekly P2 failed:", err instanceof Error ? err.message : err);
    }

    // Pipeline 3: always uses last 30 days of P1+P2 post IDs (no date override needed)
    try {
      const { mentionPostsFound, totalImported } = await scrapeConversationThreads();
      console.log(`[Scheduler] Weekly P3 done: mentionPostsFound=${mentionPostsFound}, imported=${totalImported}`);
    } catch (err) {
      console.error("[Scheduler] Weekly P3 failed:", err instanceof Error ? err.message : err);
    }

    // Build Bible v1.2 Part 7 — ledger cron after weekly scrape too.
    try {
      const { runLedgerDailyCron } = await import("./ledgerCron");
      const r = await runLedgerDailyCron();
      console.log(
        `[Scheduler] Weekly ledger cron: ${r.ambassadors} ambassadors, +${r.promoted} promoted, -${r.steppedDown} stepped down`,
      );
    } catch (err) {
      console.error("[Scheduler] Weekly ledger cron failed:", err instanceof Error ? err.message : err);
    }

    console.log(`[Scheduler] Weekly full-cohort scrape complete at ${new Date().toISOString()}`);
  });

  console.log("[Scheduler] Daily scrape (P1+P2+P3) scheduled at 06:00 SGT (22:00 UTC)");
  console.log("[Scheduler] Weekly full-cohort scrape scheduled at Sunday 00:00 SGT (Saturday 16:00 UTC)");
}
