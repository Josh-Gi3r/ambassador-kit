/**
 * Ambassador XP Calculation Engine
 * SCRAPING_SPEC_VERSION: 6.1
 * Implements MASTER.md v6.1 — DO NOT modify without reading MASTER.md Section 4 first.
 *
 * Formula:
 *   totalXP = C1 + C2 + C3 + C4 + C5 + C6 + C7 + C8 + C9 + C10 + C11
 *   (each component is already weighted — max total = 100)
 *
 * Component weights (max XP contribution) — matches MASTER.md Section 4:
 *   C1  X Post Output            12 pts  (auto, rolling 14-day window, 12% weight)
 *   C2  X Posting Spread         10 pts  (auto, rolling 14-day window, 10% weight)
 *   C3  X Engagement             14 pts  (auto, rolling 14-day window, 14% weight)
 *   C4  Content Quality          12 pts  (admin-scored, decays 25%/week, 12% weight)
 *   C5  Telegram Participation    8 pts  (auto, rolling 14-day window, 8% weight)
 *   C6  Community Value          10 pts  (admin-scored, decays 25%/week, 10% weight)
 *   C7  Builder Output            8 pts  (admin-scored proxy, 8% weight)
 *   C8  Builder Depth             6 pts  (admin-scored, decays 25%/week, 6% weight)
 *   C9  Engagement Authenticity   8 pts  (admin-scored, decays 25%/week, 8% weight)
 *   C10 Mission Alignment         7 pts  (admin-scored, decays 25%/week, 7% weight)
 *   C11 Application Quality       5 pts  (one-time admin, never decays, 5% weight)
 *   ─────────────────────────────────────────────────────────────────────────────
 *   TOTAL MAX                   100 pts
 *
 * DECAY POLICY (MASTER.md Section 4):
 *   Auto components (C1, C2, C3, C5, C7) decay naturally via rolling window.
 *   Admin-scored components (C4, C6, C8, C9, C10) decay at 25%/week without new activity.
 *   C11 never decays — one-time foundation score.
 *
 * C3 DIRECTION (CRITICAL — MASTER.md Section 4):
 *   C3 has two parts:
 *   PRIMARY (0–8 pts): engagement GIVEN by the ambassador — replies/quotes/retweets on protocol content
 *     tracked via inbound_mention pipeline rows attributed to this ambassador.
 *   BONUS (0–6 pts): engagement RECEIVED on the ambassador's own posts — weighted as
 *     quotes×4 + retweets×3 + replies×2, capped at 6 pts.
 *   Total C3 = PRIMARY + BONUS, capped at 14 pts.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { ambassadorApplications, xActivity, telegramActivity } from "../drizzle/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";

function getDb() {
  return drizzle(process.env.DATABASE_URL!);
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

/** Rolling window in days for auto-calculated components */
const ROLLING_WINDOW_DAYS = 14;

/** Total max XP — sum of all component maxes */
export const TOTAL_MAX_XP = 100;

/**
 * Max XP per component — matches MASTER.md v6.0 Section 4 formula table.
 * If you change these values, update MASTER.md first.
 */
export const COMPONENT_MAX: Record<string, number> = {
  c1: 12,  // X Post Output (12% weight)
  c2: 10,  // X Posting Spread (10% weight)
  c3: 14,  // X Engagement (14% weight — 8 primary + 6 bonus)
  c4: 12,  // Content Quality (12% weight, raw 0-10, ×1.2)
  c5: 8,   // Telegram Participation (8% weight)
  c6: 10,  // Community Value (10% weight, raw 0-10, ×1)
  c7: 8,   // Builder Output (8% weight, raw 0-10, ×0.8)
  c8: 6,   // Builder Depth (6% weight, raw 0-10, ×0.6)
  c9: 8,   // Engagement Authenticity (8% weight, raw 0-10, ×0.8)
  c10: 7,  // Mission Alignment (7% weight, raw 0-10, ×0.7)
  c11: 5,  // Application Quality (5% weight, raw 0-10, ×0.5)
};

// ── ADMIN SCORE HELPER ────────────────────────────────────────────────────────

/**
 * Map a raw admin score (0–10) to XP points (0–max).
 * No time-based decay here — decay is applied separately via applyDecay().
 */
export function mapAdminScore(rawScore: number, max: number): number {
  if (!rawScore || rawScore <= 0) return 0;
  return Math.min((rawScore / 10) * max, max);
}

/**
 * Apply 25%/week decay to an admin score based on days since last update.
 * Used for C4, C6, C8, C9, C10.
 * C11 never decays — do not pass C11 through this function.
 */
export function applyDecay(xpValue: number, updatedAt: Date | null): number {
  if (!updatedAt || xpValue <= 0) return xpValue;
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  const weeksSinceUpdate = daysSinceUpdate / 7;
  // 25% per week decay: value × (0.75 ^ weeks)
  const decayed = xpValue * Math.pow(0.75, weeksSinceUpdate);
  return Math.max(0, decayed);
}

// ── C1: X POST OUTPUT ─────────────────────────────────────────────────────────

/**
 * C1 — X Post Output (max 12 XP)
 * Count protocol-related original posts (tweetType='post') in rolling 14-day window.
 * Scoring table:
 *   0 posts  -> 0 XP
 *   1 post   -> 2 XP
 *   2–3      -> 5 XP
 *   4–5      -> 8 XP
 *   6–7      -> 10 XP
 *   8+       -> 12 XP (max)
 */
export async function calculateC1(applicationId: number, c4RawScore?: number): Promise<number> {
  const db = getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ cnt: count() })
    .from(xActivity)
    .where(
      and(
        eq(xActivity.applicationId, applicationId),
        eq(xActivity.tweetType, "post"),
        gte(xActivity.postedAt, windowStart)
      )
    );
  const postCount = rows[0]?.cnt ?? 0;
  return c1FromPostCount(postCount, c4RawScore ?? 0);
}

export function c1FromPostCount(postCount: number, _c4RawScore: number): number {
  if (postCount === 0) return 0;
  if (postCount === 1) return 2;
  if (postCount <= 3) return 5;
  if (postCount <= 5) return 8;
  if (postCount <= 7) return 10;
  return 12; // 8+ posts -> max 12 XP
}

// ── C2: X POSTING SPREAD ─────────────────────────────────────────────────────

/**
 * C2 — X Posting Spread (max 10 XP)
 * Count distinct calendar days with at least one qualifying post in rolling 14-day window.
 * Anti-dump: 10 posts on one day = spread score of 2.
 * Raw score table (MASTER.md Section 4):
 *   0 days   -> 0
 *   1 day    -> 2
 *   2–3 days -> 4
 *   4–5 days -> 6
 *   6–8 days -> 8
 *   9+ days  -> 10
 * XP = raw_score × 1
 */
export async function calculateC2(applicationId: number): Promise<number> {
  const db = getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ distinctDays: sql<number>`COUNT(DISTINCT DATE(${xActivity.postedAt}))` })
    .from(xActivity)
    .where(
      and(
        eq(xActivity.applicationId, applicationId),
        gte(xActivity.postedAt, windowStart)
      )
    );
  const days = rows[0]?.distinctDays ?? 0;
  return c2FromDays(days);
}

function c2FromDays(days: number): number {
  if (days >= 9) return 10;
  if (days >= 6) return 8;
  if (days >= 4) return 6;
  if (days >= 2) return 4;
  if (days >= 1) return 2;
  return 0;
}

// ── C3: X ENGAGEMENT RECEIVED ─────────────────────────────────────────────────

/**
 * C3 — X Engagement (max 14 XP)
 *
 * PRIMARY SCORE (0–12 XP): Engagement the ambassador GIVES on protocol-related content.
 *   - Replies, quotes, reposts on official handles, or any ambassador's protocol post.
 *   - Data source: Pipeline 2 (inbound_official) + Pipeline 3 (inbound_mention) rows in x_activity.
 *   - Each row = one engagement event the ambassador gave.
 *
 * Scoring table (interactions given in rolling 14-day window):
 *   1–2   -> 1 XP
 *   3–5   -> 2 XP
 *   6–11  -> 4 XP
 *   12–19 -> 6 XP
 *   20+   -> 8 XP  (primary max 8 — bonus adds up to +6 for total of 14)
 *   NOTE: bonus can push total up to 14; primary alone caps at 8.
 *
 * BONUS SCORE (0–6 XP): Engagement received on the ambassador's own posts.
 *   - Moderate engagement received: +1–2 XP
 *   - Strong engagement received:   +3–6 XP
 *   - "Moderate" = retweets+replies+quotes total 6–50 pts (weighted)
 *   - "Strong"   = retweets+replies+quotes total 51+ pts (weighted)
 *   - Engagement weights: quote=4, retweet=3, reply=2
 *
 * Total C3 = primary + bonus, capped at 14 XP.
 */
export async function calculateC3(applicationId: number, _c1Score: number): Promise<{ total: number; bonus: number }> {
  const db = getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Primary: count inbound_official + inbound_mention rows (engagement given by this ambassador)
  const inboundRows = await db
    .select({ cnt: count() })
    .from(xActivity)
    .where(
      and(
        eq(xActivity.applicationId, applicationId),
        sql`${xActivity.pipeline} IN ('inbound_official', 'inbound_mention')`,
        gte(xActivity.postedAt, windowStart)
      )
    );
  const interactionsGiven = Number(inboundRows[0]?.cnt ?? 0);
  const primary = c3PrimaryFromCount(interactionsGiven);

  // Bonus: engagement received on ambassador's own posts (tweetType='post', outbound)
  const receivedRows = await db
    .select({
      totalQuotes: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.quotes} ELSE 0 END)`,
      totalRetweets: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.retweets} ELSE 0 END)`,
      totalReplies: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.replies} ELSE 0 END)`,
    })
    .from(xActivity)
    .where(eq(xActivity.applicationId, applicationId));

  const r = receivedRows[0];
  const receivedPoints =
    Number(r?.totalQuotes ?? 0) * 4 +
    Number(r?.totalRetweets ?? 0) * 3 +
    Number(r?.totalReplies ?? 0) * 2;
  const bonus = c3BonusFromReceivedPoints(receivedPoints);

  return { total: Math.min(primary + bonus, COMPONENT_MAX.c3), bonus };
}

function c3PrimaryFromCount(count: number): number {
  if (count >= 20) return 8;
  if (count >= 12) return 6;
  if (count >= 6) return 4;
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

function c3BonusFromReceivedPoints(points: number): number {
  if (points >= 201) return 6; // exceptional engagement received
  if (points >= 101) return 5;
  if (points >= 51) return 4;  // strong engagement received
  if (points >= 21) return 3;
  if (points >= 6) return 2;   // moderate engagement received
  if (points >= 1) return 1;
  return 0;
}

/** @deprecated Use c3PrimaryFromCount + c3BonusFromReceivedPoints instead */
function c3RawFromPoints(points: number): number {
  if (points >= 700) return 10;
  if (points >= 401) return 9;
  if (points >= 201) return 8;
  if (points >= 101) return 7;
  if (points >= 51) return 6;
  if (points >= 21) return 5;
  if (points >= 6) return 3;
  if (points >= 1) return 1;
  return 0;
}

// ── C4: CONTENT QUALITY (admin-scored, decays 25%/week) ──────────────────────

/**
 * C4 — Content Quality (max 12 XP)
 * Admin-scored 0-10, mapped to 0-12 pts (raw × 1.2). Decays 25%/week.
 */
export function calculateC4(rawScore: number, updatedAt: Date | null): number {
  const base = mapAdminScore(rawScore, COMPONENT_MAX.c4);
  return applyDecay(base, updatedAt);
}

// ── C5: TELEGRAM PARTICIPATION ────────────────────────────────────────────────

/**
 * C5 — Telegram Participation (max 8 XP)
 * Count substantive TG messages in rolling 14-day window.
 * Filter: single-word, "gm", emoji-only, under 5 words excluded.
 * Scoring table:
 *   0 msgs   -> 0 XP
 *   1–4      -> 1 XP
 *   5–9      -> 3 XP
 *   10–19    -> 5 XP
 *   20–29    -> 7 XP
 *   30+      -> 8 XP (max)
 */
export async function calculateC5(applicationId: number): Promise<number> {
  const db = getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ cnt: count() })
    .from(telegramActivity)
    .where(
      and(
        eq(telegramActivity.applicationId, applicationId),
        gte(telegramActivity.sentAt, windowStart)
      )
    );
  const msgCount = rows[0]?.cnt ?? 0;
  return c5FromMsgCount(msgCount);
}

export function c5FromMsgCount(msgCount: number): number {
  if (msgCount >= 30) return 8;
  if (msgCount >= 20) return 7;
  if (msgCount >= 10) return 5;
  if (msgCount >= 5) return 3;
  if (msgCount >= 1) return 1;
  return 0;
}

// ── C6: COMMUNITY VALUE (admin-scored, decays 25%/week) ──────────────────────

/**
 * C6 — Community Value (max 10 XP)
 * Admin-scored 0-10, mapped to 0-10 pts (raw × 1). Decays 25%/week.
 */
export function calculateC6(rawScore: number, updatedAt: Date | null): number {
  const base = mapAdminScore(rawScore, COMPONENT_MAX.c6);
  return applyDecay(base, updatedAt);
}

// ── C7: BUILDER OUTPUT (auto — GitHub/builder activity) ──────────────────────

/**
 * C7 — Builder Output (max 8 XP)
 * Auto-calculated from GitHub/builder activity. Not yet implemented.
 * Returns 0 until Pipeline 4 (Builder Track) is live.
 * Raw score × 0.8.
 */
export function calculateC7(rawScore: number, _updatedAt: Date | null): number {
  // TODO: implement auto calculation from GitHub activity (MASTER.md Section 15, Pipeline 4)
  // For now: use admin score as proxy until auto pipeline is live
  return mapAdminScore(rawScore, COMPONENT_MAX.c7);
}

// ── C8: BUILDER DEPTH (admin-scored, decays 25%/week) ────────────────────────

/**
 * C8 — Builder Depth (max 6 XP)
 * Admin-scored 0-10, mapped to 0-6 pts (raw × 0.6). Decays 25%/week.
 */
export function calculateC8(rawScore: number, updatedAt: Date | null): number {
  const base = mapAdminScore(rawScore, COMPONENT_MAX.c8);
  return applyDecay(base, updatedAt);
}

// ── C9: ENGAGEMENT AUTHENTICITY (admin-scored, decays 25%/week) ──────────────

/**
 * C9 — Engagement Authenticity (max 8 XP)
 * Admin-scored 0-10, mapped to 0-8 pts (raw × 0.8). Decays 25%/week.
 * Acts as a check on C3. High C3 + low C9 = suspicious pattern.
 */
export function calculateC9(rawScore: number, updatedAt: Date | null): number {
  const base = mapAdminScore(rawScore, COMPONENT_MAX.c9);
  return applyDecay(base, updatedAt);
}

// ── C10: MISSION ALIGNMENT (admin-scored, decays 25%/week) ───────────────────

/**
 * C10 — Mission Alignment (max 7 XP)
 * Admin-scored 0-10, mapped to 0-7 pts (raw × 0.7). Decays 25%/week.
 * Score of 0–2 triggers escalation regardless of total XP.
 */
export function calculateC10(rawScore: number, updatedAt: Date | null): number {
  const base = mapAdminScore(rawScore, COMPONENT_MAX.c10);
  return applyDecay(base, updatedAt);
}

// ── C11: APPLICATION QUALITY (one-time, never decays) ────────────────────────

/**
 * C11 — Application Quality (max 5 XP)
 * One-time admin score from knowledge test. testScore is 0-10, mapped to 0-5 pts.
 * NEVER decays — it is a foundation score.
 */
export function calculateC11(testScore: number): number {
  return Math.min((testScore / 10) * COMPONENT_MAX.c11, COMPONENT_MAX.c11);
}

// ── TREND CALCULATION ─────────────────────────────────────────────────────────

/**
 * Calculate XP trend from snapshot history.
 * Compares avg XP of last 7 days vs prior 7 days.
 * Returns: 1=rising, 0=stable, -1=falling
 * Threshold: ±2 XP difference (MASTER.md Section 6).
 */
export function calculateTrend(
  snapshotHistory: Array<{ date: string; xp: number }> | null
): number {
  if (!snapshotHistory || snapshotHistory.length < 2) return 0;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * dayMs;
  const fourteenDaysAgo = now - 14 * dayMs;

  const recent = snapshotHistory.filter((s) => new Date(s.date).getTime() >= sevenDaysAgo);
  const prior = snapshotHistory.filter(
    (s) =>
      new Date(s.date).getTime() >= fourteenDaysAgo &&
      new Date(s.date).getTime() < sevenDaysAgo
  );

  if (recent.length === 0 || prior.length === 0) return 0;

  const recentAvg = recent.reduce((sum, s) => sum + s.xp, 0) / recent.length;
  const priorAvg = prior.reduce((sum, s) => sum + s.xp, 0) / prior.length;

  const delta = recentAvg - priorAvg;
  if (delta > 2) return 1;   // rising: more than 2 pts improvement
  if (delta < -2) return -1; // falling: more than 2 pts drop
  return 0;                  // stable
}

// ── FULL XP CALCULATION ───────────────────────────────────────────────────────

export interface XPBreakdown {
  c1: number;
  c2: number;
  c3: number;
  c3Bonus: number;
  c4: number;
  c5: number;
  c6: number;
  c7: number;
  c8: number;
  c9: number;
  c10: number;
  c11: number;
  totalXP: number;
  trend: number;
}

/**
 * Calculate full XP for an ambassador.
 * Returns breakdown of all 11 components + totalXP + trend.
 */
export async function calculateTotalXP(
  ambassador: typeof ambassadorApplications.$inferSelect
): Promise<XPBreakdown> {
  const c4Raw = ambassador.c4ContentQuality ?? 0;
  const c1 = await calculateC1(ambassador.id, c4Raw);
  const c2 = await calculateC2(ambassador.id);
  const c3Result = await calculateC3(ambassador.id, c1);
  const c3 = c3Result.total;
  const c3Bonus = c3Result.bonus;
  const c4 = calculateC4(c4Raw, ambassador.c4UpdatedAt);
  const c5 = await calculateC5(ambassador.id);
  const c6 = calculateC6(ambassador.c6CommunityValue ?? 0, ambassador.c6UpdatedAt);
  const c7 = calculateC7(ambassador.c7BuilderOutput ?? 0, ambassador.c7UpdatedAt);
  const c8 = calculateC8(ambassador.c8BuilderDepth ?? 0, ambassador.c8UpdatedAt);
  const c9 = calculateC9(ambassador.c9EngagementAuth ?? 0, ambassador.c9UpdatedAt);
  const c10 = calculateC10(ambassador.c10MissionAlign ?? 0, ambassador.c10UpdatedAt);
  const c11 = calculateC11(ambassador.testScore ?? 0);

  const totalXP = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;

  const snapshotHistory = ambassador.xpSnapshotHistory as Array<{
    date: string;
    xp: number;
  }> | null;
  const trend = calculateTrend(snapshotHistory);

  return { c1, c2, c3, c3Bonus, c4, c5, c6, c7, c8, c9, c10, c11, totalXP, trend };
}

// ── SNAPSHOT ──────────────────────────────────────────────────────────────────

/**
 * Add today's XP to the snapshot history array.
 * Keeps last 90 days of snapshots.
 */
export function addXPSnapshot(
  existing: Array<{ date: string; xp: number }> | null,
  xp: number
): Array<{ date: string; xp: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const history = existing ?? [];
  const filtered = history.filter((s) => s.date !== today);
  filtered.push({ date: today, xp });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  return filtered.slice(-90);
}

// ── BULK RECALCULATE ──────────────────────────────────────────────────────────

/**
 * Bulk-recalculate XP for ALL ambassadors using aggregated SQL queries.
 * Uses 2 bulk GROUP BY queries + N sequential UPDATEs (for JSON snapshot field).
 * SCRAPING_SPEC_VERSION: 6.0 — matches MASTER.md v6.0 Section 4.
 */
export async function recalculateAllXP(): Promise<number> {
  const db = getDb();
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ── Bulk query 1: X activity aggregates per ambassador ──────────────────────
  // C3 primary: count of inbound_official + inbound_mention rows (engagement given by ambassador)
  // C3 bonus: engagement received on ambassador's own posts (retweets/replies/quotes metadata)
  const xAgg = await db
    .select({
      applicationId: xActivity.applicationId,
      postCount: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN 1 ELSE 0 END)`,
      distinctDays: sql<number>`COUNT(DISTINCT CASE WHEN ${xActivity.postedAt} >= ${windowStart} THEN DATE(${xActivity.postedAt}) END)`,
      // C3 primary: engagement GIVEN by ambassador (P2 + P3 rows)
      inboundCount: sql<number>`SUM(CASE WHEN ${xActivity.pipeline} IN ('inbound_official', 'inbound_mention') AND ${xActivity.postedAt} >= ${windowStart} THEN 1 ELSE 0 END)`,
      // C3 bonus: engagement RECEIVED on ambassador's own posts
      receivedQuotes: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.quotes} ELSE 0 END)`,
      receivedRetweets: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.retweets} ELSE 0 END)`,
      receivedReplies: sql<number>`SUM(CASE WHEN ${xActivity.tweetType} = 'post' AND ${xActivity.postedAt} >= ${windowStart} THEN ${xActivity.replies} ELSE 0 END)`,
    })
    .from(xActivity)
    .groupBy(xActivity.applicationId);

  // ── Bulk query 2: Telegram activity count per ambassador ─────────────────────
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

  // ── Load all ambassadors and update each with pre-computed aggregates ─────────
  const ambassadors = await db.select().from(ambassadorApplications);
  let updated = 0;

  for (const ambassador of ambassadors) {
    // Skip accounts hidden from leaderboard (e.g. admin/test accounts) — no decay, no recalc
    if (ambassador.hideFromLeaderboard) continue;
    try {
      const xData = xMap.get(ambassador.id);
      const tgData = tgMap.get(ambassador.id);

      const postCount = Number(xData?.postCount ?? 0);
      const c4Raw = ambassador.c4ContentQuality ?? 0;
      const c1 = c1FromPostCount(postCount, c4Raw);
      const c2 = c2FromDays(Number(xData?.distinctDays ?? 0));

      // C3 primary: engagement GIVEN (P2+P3 inbound rows)
      const interactionsGiven = Number(xData?.inboundCount ?? 0);
      const c3Primary = c3PrimaryFromCount(interactionsGiven);
      // C3 bonus: engagement RECEIVED on own posts
      const receivedPoints =
        Number(xData?.receivedQuotes ?? 0) * 4 +
        Number(xData?.receivedRetweets ?? 0) * 3 +
        Number(xData?.receivedReplies ?? 0) * 2;
      const c3Bonus = c3BonusFromReceivedPoints(receivedPoints);
      const c3 = Math.min(c3Primary + c3Bonus, COMPONENT_MAX.c3);

      // Admin-scored components with decay
      const c4 = applyDecay(mapAdminScore(c4Raw, COMPONENT_MAX.c4), ambassador.c4UpdatedAt);
      const c5 = c5FromMsgCount(Number(tgData?.msgCount ?? 0));
      const c6 = applyDecay(mapAdminScore(ambassador.c6CommunityValue ?? 0, COMPONENT_MAX.c6), ambassador.c6UpdatedAt);
      const c7 = mapAdminScore(ambassador.c7BuilderOutput ?? 0, COMPONENT_MAX.c7);
      const c8 = applyDecay(mapAdminScore(ambassador.c8BuilderDepth ?? 0, COMPONENT_MAX.c8), ambassador.c8UpdatedAt);
      const c9 = applyDecay(mapAdminScore(ambassador.c9EngagementAuth ?? 0, COMPONENT_MAX.c9), ambassador.c9UpdatedAt);
      const c10 = applyDecay(mapAdminScore(ambassador.c10MissionAlign ?? 0, COMPONENT_MAX.c10), ambassador.c10UpdatedAt);
      const c11 = calculateC11(ambassador.testScore ?? 0);

      const totalXP = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;
      const trend = calculateTrend(
        ambassador.xpSnapshotHistory as Array<{ date: string; xp: number }> | null
      );
      const snapshotHistory = addXPSnapshot(
        ambassador.xpSnapshotHistory as Array<{ date: string; xp: number }> | null,
        totalXP
      );

      await db
        .update(ambassadorApplications)
        .set({
          xpC1: c1, xpC2: c2, xpC3: c3, xpC3Bonus: c3Bonus, xpC4: c4, xpC5: c5,
          xpC6: c6, xpC7: c7, xpC8: c8, xpC9: c9, xpC10: c10, xpC11: c11,
          totalXP,
          xpTrend: trend,
          xpSnapshotHistory: snapshotHistory,
          xpUpdatedAt: new Date(),
        })
        .where(eq(ambassadorApplications.id, ambassador.id));

      updated++;
    } catch (err) {
      console.error(`[XP] Failed to update XP for ambassador ${ambassador.id}:`, err);
    }
  }

  // Build Bible v1.2 §5.2 step 1 — the legacy scoring path is FROZEN. The
  // ledger engine (server/ledgerCron.ts) now owns lifetime_xp / tier / the
  // founding tier and AI tier-sync. The legacy v2.0 lifetime accumulation
  // (applyDailyEarnAndTiers) and legacy AI sync (syncAiAccess) are NOT
  // called here any more — calling them would clobber the ledger-derived
  // lifetime_xp with the deleted floor((totalXP/100)^0.8×50) formula. This
  // function still computes the legacy 0–100 totalXP / C1–C11 only; those
  // are read once by the migration and removed entirely at Build Step 6.

  return updated;
}

/**
 * Recalculate XP for a single ambassador by ID and persist to DB.
 * Used by admin panel when scoring individual ambassadors.
 */
export async function recalculateXPForAmbassador(applicationId: number): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, applicationId));
  if (!rows.length) return;
  const ambassador = rows[0];
  const breakdown = await calculateTotalXP(ambassador);
  const snapshotHistory = addXPSnapshot(
    ambassador.xpSnapshotHistory as Array<{ date: string; xp: number }> | null,
    breakdown.totalXP
  );
  await db
    .update(ambassadorApplications)
    .set({
      xpC1: breakdown.c1,
      xpC2: breakdown.c2,
      xpC3: breakdown.c3,
      xpC3Bonus: breakdown.c3Bonus,
      xpC4: breakdown.c4,
      xpC5: breakdown.c5,
      xpC6: breakdown.c6,
      xpC7: breakdown.c7,
      xpC8: breakdown.c8,
      xpC9: breakdown.c9,
      xpC10: breakdown.c10,
      xpC11: breakdown.c11,
      totalXP: breakdown.totalXP,
      xpTrend: breakdown.trend,
      xpSnapshotHistory: snapshotHistory,
      xpUpdatedAt: new Date(),
    })
    .where(eq(ambassadorApplications.id, applicationId));
}
