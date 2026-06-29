/**
 * apply-scores.ts
 * Computes XP for all ambassadors from existing DB data and WRITES scores to DB.
 *
 * Run: node --import tsx/esm scripts/apply-scores.ts
 */
import { getDb } from "../server/db";
import {
  ambassadorApplications,
  xActivity,
  telegramActivity,
} from "../drizzle/schema";
import { sql, gte, eq } from "drizzle-orm";

const ROLLING_WINDOW_DAYS = 14;

function bulkC1(postCount: number): number {
  if (postCount >= 8) return 12;
  if (postCount >= 6) return 10;
  if (postCount >= 4) return 8;
  if (postCount >= 2) return 5;
  if (postCount >= 1) return 2;
  return 0;
}

function bulkC2(dayCount: number): number {
  if (dayCount >= 10) return 10;
  if (dayCount >= 7) return 8;
  if (dayCount >= 5) return 6;
  if (dayCount >= 3) return 4;
  if (dayCount >= 1) return 2;
  return 0;
}

function bulkC3(givenCount: number, receivedEngagement: number): number {
  // Bucket A: engagement given (8 pts max)
  let bucketA = 0;
  if (givenCount >= 20) bucketA = 8;
  else if (givenCount >= 10) bucketA = 6;
  else if (givenCount >= 5) bucketA = 4;
  else if (givenCount >= 2) bucketA = 2;
  else if (givenCount >= 1) bucketA = 1;

  // Bucket B: reach received (2 pts max)
  let bucketB = 0;
  if (receivedEngagement >= 200) bucketB = 2;
  else if (receivedEngagement >= 100) bucketB = 1.5;
  else if (receivedEngagement >= 50) bucketB = 1;
  else if (receivedEngagement >= 20) bucketB = 0.5;

  return Math.min(bucketA + bucketB, 10);
}

function bulkC5(msgCount: number): number {
  if (msgCount >= 36) return 5;
  if (msgCount >= 21) return 4;
  if (msgCount >= 11) return 3;
  if (msgCount >= 4) return 2;
  if (msgCount >= 1) return 1;
  return 0;
}

function applyDecay(score: number, lastActivityDate: Date | null): number {
  if (!lastActivityDate || score <= 0) return score;
  const now = new Date();
  const weeksElapsed = Math.floor(
    (now.getTime() - lastActivityDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  if (weeksElapsed <= 0) return score;
  return score * Math.pow(0.75, weeksElapsed);
}

async function main() {
  const db = await getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Bulk X activity aggregation
  const xAgg = await db
    .select({
      applicationId: xActivity.applicationId,
      postCount: sql<number>`COUNT(CASE WHEN ${xActivity.tweetType} = 'post' THEN 1 END)`,
      dayCount: sql<number>`COUNT(DISTINCT DATE(${xActivity.postedAt}))`,
      givenCount: sql<number>`COUNT(CASE WHEN ${xActivity.tweetType} IN ('reply','quote') THEN 1 END)`,
      totalLikes: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' THEN COALESCE(${xActivity.likes}, 0) ELSE 0 END)`,
      totalRetweets: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' THEN COALESCE(${xActivity.retweets}, 0) ELSE 0 END)`,
      totalReplies: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' THEN COALESCE(${xActivity.replies}, 0) ELSE 0 END)`,
    })
    .from(xActivity)
    .where(gte(xActivity.postedAt, windowStart))
    .groupBy(xActivity.applicationId);

  // Bulk Telegram aggregation
  const tgAgg = await db
    .select({
      applicationId: telegramActivity.applicationId,
      msgCount: sql<number>`COUNT(*)`,
    })
    .from(telegramActivity)
    .where(gte(telegramActivity.sentAt, windowStart))
    .groupBy(telegramActivity.applicationId);

  // Build lookup maps
  const xMap = new Map(xAgg.map((r) => [r.applicationId, r]));
  const tgMap = new Map(tgAgg.map((r) => [r.applicationId, r]));

  // Get all ambassadors
  const ambassadors = await db
    .select({
      id: ambassadorApplications.id,
      c4ContentQuality: ambassadorApplications.c4ContentQuality,
      c6CommunityValue: ambassadorApplications.c6CommunityValue,
      c7BuilderOutput: ambassadorApplications.c7BuilderOutput,
      c8BuilderDepth: ambassadorApplications.c8BuilderDepth,
      c9EngagementAuth: ambassadorApplications.c9EngagementAuth,
      c10MissionAlign: ambassadorApplications.c10MissionAlign,
      xpC11: ambassadorApplications.xpC11,
      c4UpdatedAt: ambassadorApplications.c4UpdatedAt,
      c6UpdatedAt: ambassadorApplications.c6UpdatedAt,
      c8UpdatedAt: ambassadorApplications.c8UpdatedAt,
      c9UpdatedAt: ambassadorApplications.c9UpdatedAt,
      c10UpdatedAt: ambassadorApplications.c10UpdatedAt,
      twitterHandle: ambassadorApplications.twitterHandle,
    })
    .from(ambassadorApplications);

  const results: Array<{ id: number; handle: string; total: number }> = [];

  for (const amb of ambassadors) {
    const x = xMap.get(amb.id);
    const tg = tgMap.get(amb.id);

    const c1 = bulkC1(Number(x?.postCount ?? 0));
    const c2 = bulkC2(Number(x?.dayCount ?? 0));
    const receivedEngagement =
      Number(x?.totalLikes ?? 0) +
      Number(x?.totalReplies ?? 0) +
      Number(x?.totalRetweets ?? 0);
    const c3 = bulkC3(Number(x?.givenCount ?? 0), receivedEngagement);
    const c5 = bulkC5(Number(tg?.msgCount ?? 0));

    // Apply decay to qualitative scores (each has its own last-update timestamp)
    const c4 = applyDecay(amb.c4ContentQuality ?? 0, amb.c4UpdatedAt ? new Date(amb.c4UpdatedAt) : null);
    const c6 = applyDecay(amb.c6CommunityValue ?? 0, amb.c6UpdatedAt ? new Date(amb.c6UpdatedAt) : null);
    const c8 = applyDecay(amb.c8BuilderDepth ?? 0, amb.c8UpdatedAt ? new Date(amb.c8UpdatedAt) : null);
    const c9 = applyDecay(amb.c9EngagementAuth ?? 0, amb.c9UpdatedAt ? new Date(amb.c9UpdatedAt) : null);
    const c10 = applyDecay(amb.c10MissionAlign ?? 0, amb.c10UpdatedAt ? new Date(amb.c10UpdatedAt) : null);
    const c7 = amb.c7BuilderOutput ?? 0;
    const c11 = amb.xpC11 ?? 0;

    const total = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;

    // Write to DB
    await db
      .update(ambassadorApplications)
      .set({
        xpC1: c1,
        xpC2: c2,
        xpC3: c3,
        xpC5: c5,
        totalXP: total,
        xpUpdatedAt: new Date(),
      })
      .where(eq(ambassadorApplications.id, amb.id));

    results.push({ id: amb.id, handle: amb.twitterHandle ?? `#${amb.id}`, total });
  }

  results.sort((a, b) => b.total - a.total);
  console.log("\n=== SCORES APPLIED ===");
  results.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(3)}. @${r.handle.padEnd(25)} ${r.total.toFixed(1)} XP`);
  });
  console.log(`\nTotal ambassadors updated: ${results.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
