/**
 * preview-scores-inner.ts
 * Runs full scrape then computes XP for all ambassadors in READ-ONLY mode.
 * Prints results table — does NOT write scores to DB.
 */
import { scrapeAllAmbassadorsX, getScrapeJob } from "../server/xScraper";
import { getDb } from "../server/db";
import {
  ambassadorApplications,
  xActivity,
  telegramActivity,
} from "../drizzle/schema";
import { sql, isNotNull, gte } from "drizzle-orm";

const ROLLING_WINDOW_DAYS = 14;

// ── XP helpers (mirrors xpEngine.ts) ─────────────────────────────────────────
function bulkC1(postCount: number): number {
  if (postCount >= 8) return 12;
  if (postCount >= 6) return 10;
  if (postCount >= 4) return 8;
  if (postCount >= 2) return 5;
  if (postCount >= 1) return 2;
  return 0;
}
function bulkC2(days: number): number {
  if (days >= 10) return 10;
  if (days >= 7) return 8;
  if (days >= 5) return 6;
  if (days >= 3) return 4;
  if (days >= 1) return 2;
  return 0;
}
function bulkC3(r: { givenCount: number; totalReplies: number; totalRetweets: number; totalLikes: number } | undefined): number {
  if (!r) return 0;
  const givenCount = Number(r.givenCount ?? 0);
  let bucketA: number;
  if (givenCount >= 20) bucketA = 8;
  else if (givenCount >= 12) bucketA = 6;
  else if (givenCount >= 6) bucketA = 4;
  else if (givenCount >= 3) bucketA = 2;
  else if (givenCount >= 1) bucketA = 1;
  else bucketA = 0;
  const receivedPoints =
    Number(r.totalReplies ?? 0) * 3 +
    Number(r.totalRetweets ?? 0) * 1 +
    Number(r.totalLikes ?? 0) * 0.5;
  let bucketB: number;
  if (receivedPoints >= 100) bucketB = 2;
  else if (receivedPoints >= 30) bucketB = 1.5;
  else if (receivedPoints >= 10) bucketB = 1;
  else if (receivedPoints > 0) bucketB = 0.5;
  else bucketB = 0;
  return bucketA + bucketB;
}
function bulkC5(msgCount: number): number {
  if (msgCount >= 30) return 8;
  if (msgCount >= 20) return 7;
  if (msgCount >= 10) return 5;
  if (msgCount >= 5) return 3;
  if (msgCount >= 1) return 1;
  return 0;
}
function decayScore(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  if (!raw || raw <= 0) return 0;
  if (!updatedAt) return raw;
  const weeksElapsed = (Date.now() - updatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
  if (weeksElapsed < 1) return raw;
  return raw * Math.pow(0.75, Math.floor(weeksElapsed));
}
function calculateC4(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC6(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC7(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC8(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC9(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC10(raw: number | null | undefined, updatedAt: Date | null | undefined): number {
  return decayScore(raw, updatedAt);
}
function calculateC11(testScore: number | null | undefined): number {
  if (!testScore) return 0;
  if (testScore >= 10) return 5;
  if (testScore >= 8) return 4;
  if (testScore >= 6) return 3;
  if (testScore >= 4) return 2;
  return 1;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== AMBASSADOR SCORE PREVIEW ===\n");

  // ── Step 1: Full scrape ────────────────────────────────────────────────────
  console.log("Starting full scrape of all ambassadors...");
  const { jobId, total } = await scrapeAllAmbassadorsX();
  console.log(`Scrape job started: ${jobId} | Total ambassadors: ${total}`);

  // Poll until done
  let lastDone = -1;
  while (true) {
    const job = getScrapeJob(jobId);
    if (!job) { console.log("Job not found — may have expired"); break; }
    if (job.done !== lastDone) {
      process.stdout.write(`\rProgress: ${job.done}/${job.total} (${job.succeeded} ok, ${job.failed} failed, ${job.totalTweets} tweets)`);
      lastDone = job.done;
    }
    if (job.status === "completed" || job.status === "failed") {
      console.log(`\nScrape ${job.status}. Tweets collected: ${job.totalTweets}`);
      break;
    }
    await sleep(3000);
  }

  // ── Step 2: Compute scores (read-only) ────────────────────────────────────
  console.log("\nComputing XP scores (read-only — no DB writes)...\n");
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const xAgg = await db
    .select({
      applicationId: xActivity.applicationId,
      postCount: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN 1 ELSE 0 END)`,
      distinctDays: sql<number>`COUNT(DISTINCT CASE WHEN ${xActivity.postedAt} >= ${windowStart} THEN DATE(${xActivity.postedAt}) END)`,
      givenCount: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} IN ('reply', 'quote') AND ${xActivity.postedAt} >= ${windowStart} THEN 1 ELSE 0 END)`,
      totalLikes: sql<number>`SUM(CASE WHEN ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.likes} ELSE 0 END)`,
      totalRetweets: sql<number>`SUM(CASE WHEN ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.retweets} ELSE 0 END)`,
      totalReplies: sql<number>`SUM(CASE WHEN ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.replies} ELSE 0 END)`,
    })
    .from(xActivity)
    .groupBy(xActivity.applicationId);

  const tgAgg = await db
    .select({
      applicationId: telegramActivity.applicationId,
      msgCount: sql<number>`COUNT(*)`,
    })
    .from(telegramActivity)
    .where(gte(telegramActivity.sentAt, windowStart))
    .groupBy(telegramActivity.applicationId);

  const xMap = new Map(xAgg.map((r) => [r.applicationId, r]));
  const tgMap = new Map(tgAgg.map((r) => [r.applicationId, r]));

  const ambassadors = await db.select().from(ambassadorApplications);

  type Row = {
    handle: string;
    c1: number; c2: number; c3: number; c4: number; c5: number;
    c6: number; c7: number; c8: number; c9: number; c10: number; c11: number;
    total: number;
    prevTotal: number | null;
    diff: string;
  };

  const rows: Row[] = [];

  for (const amb of ambassadors) {
    const xData = xMap.get(amb.id);
    const tgData = tgMap.get(amb.id);
    const c1 = bulkC1(Number(xData?.postCount ?? 0));
    const c2 = bulkC2(Number(xData?.distinctDays ?? 0));
    const c3 = bulkC3(
      xData
        ? { givenCount: Number(xData.givenCount), totalReplies: Number(xData.totalReplies), totalRetweets: Number(xData.totalRetweets), totalLikes: Number(xData.totalLikes) }
        : undefined
    );
    const c4 = calculateC4(amb.c4ContentQuality, amb.c4UpdatedAt);
    const c5 = bulkC5(Number(tgData?.msgCount ?? 0));
    const c6 = calculateC6(amb.c6CommunityValue, amb.c6UpdatedAt);
    const c7 = calculateC7(amb.c7BuilderOutput, amb.c7UpdatedAt);
    const c8 = calculateC8(amb.c8BuilderDepth, amb.c8UpdatedAt);
    const c9 = calculateC9(amb.c9EngagementAuth, amb.c9UpdatedAt);
    const c10 = calculateC10(amb.c10MissionAlign, amb.c10UpdatedAt);
    const c11 = calculateC11(amb.testScore);
    const total = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;
    const prevTotal = amb.totalXP ?? null;
    const diff = prevTotal !== null
      ? (total - prevTotal > 0 ? `+${(total - prevTotal).toFixed(1)}` : (total - prevTotal).toFixed(1))
      : "NEW";

    rows.push({
      handle: amb.twitterHandle ?? amb.telegramHandle ?? `ID:${amb.id}`,
      c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11,
      total,
      prevTotal,
      diff,
    });
  }

  // Sort by new total descending
  rows.sort((a, b) => b.total - a.total);

  // Print table
  const header = ["#", "Handle", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "TOTAL", "PREV", "DIFF"];
  const colWidths = [3, 22, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7];
  const pad = (s: string | number, w: number) => String(s).padStart(w);
  const line = header.map((h, i) => pad(h, colWidths[i])).join(" | ");
  const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");
  console.log(line);
  console.log(sep);

  rows.forEach((r, i) => {
    const cols = [
      i + 1,
      r.handle.slice(0, 22),
      r.c1.toFixed(0), r.c2.toFixed(0), r.c3.toFixed(1),
      r.c4.toFixed(1), r.c5.toFixed(0), r.c6.toFixed(1),
      r.c7.toFixed(1), r.c8.toFixed(1), r.c9.toFixed(1),
      r.c10.toFixed(1), r.c11.toFixed(0),
      r.total.toFixed(1),
      r.prevTotal !== null ? r.prevTotal.toFixed(1) : "—",
      r.diff,
    ];
    console.log(cols.map((c, i) => pad(c, colWidths[i])).join(" | "));
  });

  console.log(`\nTotal ambassadors: ${rows.length}`);
  console.log("Scores NOT written to DB. Run recalculateAllXP() to apply.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
