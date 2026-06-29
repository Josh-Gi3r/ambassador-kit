import { desc, eq, and, gte, lte, isNull, isNotNull, sql, notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  journalEntries,
  ambassadorApplications,
  ambassadorBadges,
  InsertAmbassadorApplication,
  InsertUser,
  users,
  telegramActivity,
  telegramBatches,
  featuredPosts,
  builderSubmissions,
  badgeEvents,
  programConfig,
  foundingConfig,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Handles excluded from ALL public-facing stats, leaderboards, and XP totals.
// These accounts are used for testing and must never affect public numbers.
export const EXCLUDED_HANDLES = ['your-test-handle', 'admin-handle'] as const;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── SENSITIVE FIELD SCRUB ────────────────────────────────────────────────────
// litellm_key is a server-only AI gateway credential. It must NEVER reach the
// browser. Server-only AI paths (getAIContext) read it via their own dedicated
// query; every public/admin read path that returns ambassador rows is routed
// through this scrub. Scrubbing the secret post-query (vs an 80-column
// allowlist) is equivalent for the security goal and does not drift as columns
// are added.
const SENSITIVE_AMBASSADOR_FIELDS = ["litellmKey", "litellmKeyIssuedAt"] as const;

export function scrubAmbassador<T>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const copy = { ...(row as Record<string, unknown>) };
  for (const f of SENSITIVE_AMBASSADOR_FIELDS) delete copy[f];
  return copy as T;
}

function scrubAmbassadors<T>(rows: T[]): T[] {
  return rows.map(scrubAmbassador);
}

// ── PROGRAM CONFIG ───────────────────────────────────────────────────────────
export async function getProgramConfig(key: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(programConfig)
    .where(eq(programConfig.key, key))
    .limit(1);
  return row ?? null;
}

export async function setProgramConfig(
  key: string,
  value: string,
  extra?: {
    closedAt?: Date;
    communityTotalAtClose?: number;
    solitaireCount?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getProgramConfig(key);
  if (existing) {
    await db
      .update(programConfig)
      .set({ value, ...extra })
      .where(eq(programConfig.key, key));
  } else {
    await db.insert(programConfig).values({ key, value, ...extra });
  }
}

// ── USERS ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  if (user.telegramId !== undefined) {
    values.telegramId = user.telegramId;
    updateSet.telegramId = user.telegramId;
  }

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (
    user.openId === ENV.ownerOpenId ||
    (user.email && ENV.adminEmails.includes(user.email.toLowerCase()))
  ) {
    // S6 — grant `admin` ONLY on first insert. On subsequent logins, leave
    // role alone so a role change in the DB (revoke) isn't silently undone
    // because the email still appears in ADMIN_EMAILS, and so a hijacked
    // session that flips a non-admin email cannot re-promote later.
    values.role = "admin";
    // intentionally NOT set in updateSet
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getApplicationByTelegramHandle(handle: string) {
  const db = await getDb();
  if (!db) return null;
  // Normalize: strip leading @
  const clean = handle.replace(/^@/, "").toLowerCase();
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(
      sql`LOWER(REPLACE(${ambassadorApplications.telegramHandle}, '@', '')) = ${clean}`
    )
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserByTelegramId(telegramId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── AMBASSADOR APPLICATIONS ──────────────────────────────────────────────────

/**
 * Check if an email already exists in the applications table.
 * Returns the existing record (with isEvangelist + lastStep) or null.
 */
export async function checkEmailForApplication(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Update the lastStep field for an in-progress application.
 */
export async function updateApplicationProgress(
  id: number,
  lastStep: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(ambassadorApplications)
    .set({ lastStep })
    .where(eq(ambassadorApplications.id, id));
}

export async function createApplication(
  data: InsertAmbassadorApplication
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ambassadorApplications).values(data);
  const insertId = (result[0] as { insertId: number }).insertId;
  // Auto-provision AI access if they came in already at L1+ (test passed).
  if (Number(data.level ?? 0) >= 1) {
    const { syncAiAccess } = await import("./ai/syncAiAccess");
    await syncAiAccess({
      id: insertId,
      level: Number(data.level ?? 0),
      currentTier: "initiate",
      claimPending: data.claimPending ?? 0,
      fraudFlag: data.fraudFlag ?? 0,
      twitterHandle: data.twitterHandle ?? null,
      litellmKey: null,
    });
  }
  return insertId;
}

export async function listApplications(filters?: {
  status?: "pending" | "approved" | "rejected";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) conditions.push(eq(ambassadorApplications.status, filters.status));

  const rows = await db
    .select()
    .from(ambassadorApplications)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(ambassadorApplications.createdAt));
  return scrubAmbassadors(rows);
}

export async function getApplicationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateApplicationStatus(
  id: number,
  status: "pending" | "approved" | "rejected",
  adminNotes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { status };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  // Approval grants L2 Ambassador. Revoking (pending/rejected) drops back to L1.
  if (status === "approved") updateData.level = 2;
  else if (status === "pending" || status === "rejected") updateData.level = 1;
  await db
    .update(ambassadorApplications)
    .set(updateData)
    .where(eq(ambassadorApplications.id, id));
  // Level changed (L1/L2 grant or revoke) — reconcile AI access.
  const fresh = await getApplicationById(id);
  if (fresh) {
    const { syncAiAccess } = await import("./ai/syncAiAccess");
    await syncAiAccess({
      id: fresh.id,
      level: fresh.level,
      currentTier: fresh.currentTier,
      claimPending: fresh.claimPending,
      fraudFlag: fresh.fraudFlag,
      twitterHandle: fresh.twitterHandle,
      litellmKey: fresh.litellmKey,
    });
  }
}

export async function getApplicationStats() {
  const db = await getDb();
  if (!db)
    return { total: 0, pending: 0, approved: 0, rejected: 0 };

   const rows = await db
    .select()
    .from(ambassadorApplications)
    .where(or(
      isNull(ambassadorApplications.twitterHandle),
      notInArray(ambassadorApplications.twitterHandle, [...EXCLUDED_HANDLES])
    ));
  const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    stats.total += 1;
    stats[row.status] += 1;
  }
  return stats;
}

// ── RANKING & SCORING ────────────────────────────────────────────────────────

export type BadgeKey =
  | "knowledgeable"   // test score 8+
  | "perfect_score"   // test score 10
  | "articulate"      // answer depth high
  | "consistent"      // xConsistencyScore >= 7
  | "community_builder" // communityContribScore >= 7
  | "amplifier"       // communityContribScore >= 5 + tgActivityScore >= 5
  | "creator"         // xContentScore >= 7
  | "high_reach"      // xEngagementScore >= 7
  | "network_embedded" // communityLinks.length >= 2
  | "evangelist_candidate"; // evangelistCandidate === 1

export type LevelInfo = {
  level: number;
  name: string;
  color: string;
};

export const LEVELS: LevelInfo[] = [
  { level: 0, name: "Applicant",        color: "#808080" },
  { level: 1, name: "Contributor",      color: "#C0C0C0" },
  { level: 2, name: "Ambassador",       color: "#00FF9D" },
  { level: 3, name: "Lead Ambassador",  color: "#00CC7D" },
  { level: 4, name: "Ecosystem Lead",   color: "#00AA60" },
  { level: 5, name: "Full-Time",        color: "#FFD700" },
];

/**
 * Scoring weights for standard Ambassador ranking.
 * All inputs are 0–10 unless noted.
 */
export const AMBASSADOR_WEIGHTS = {
  testScore: 0.20,          // 0–10 → up to 20 pts
  answerDepth: 0.15,        // 0–10 derived → up to 15 pts
  completeness: 0.10,       // 0–10 derived → up to 10 pts
  communityLinks: 0.10,     // 0–10 derived → up to 10 pts
  evangelistBonus: 0.05,    // 0 or 10 → up to 5 pts
  xContentScore: 0.15,      // 0–10 manual → up to 15 pts
  xEngagementScore: 0.10,   // 0–10 manual → up to 10 pts
  xConsistencyScore: 0.05,  // 0–10 manual → up to 5 pts
  communityContribScore: 0.05, // 0–10 manual → up to 5 pts
  tgActivityScore: 0.05,    // 0–10 manual → up to 5 pts
};

/**
 * Scoring weights for Evangelist (Token2049) ranking — harder criteria.
 */
export const EVANGELIST_WEIGHTS = {
  testScore: 0.15,
  answerDepth: 0.15,
  completeness: 0.05,
  communityLinks: 0.05,
  evangelistBonus: 0.05,
  xContentScore: 0.25,      // Content quality is critical for Evangelist
  xEngagementScore: 0.15,   // Real reach matters more
  xConsistencyScore: 0.10,  // Consistency is heavily weighted
  communityContribScore: 0.05,
  tgActivityScore: 0.00,
};

/**
 * Derive answer depth score (0–10) from text length of the three long-form answers.
 */
function deriveAnswerDepth(app: { protocolDescription: string; communityBenefit: string; firstThirtyDays: string }): number {
  const totalWords = [app.protocolDescription, app.communityBenefit, app.firstThirtyDays]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  // 0 words = 0, 300+ words = 10
  return Math.min(10, Math.round((totalWords / 300) * 10));
}

/**
 * Derive completeness score (0–10) based on optional fields filled in.
 */
function deriveCompleteness(app: {
  twitterHandle?: string | null;
  telegramHandle?: string | null;
  githubHandle?: string | null;
  otherLinks?: string | null;
  communityLinks?: unknown;
}): number {
  let filled = 0;
  if (app.twitterHandle) filled++;
  if (app.telegramHandle) filled++;
  if (app.githubHandle) filled++;
  if (app.otherLinks) filled++;
  const links = Array.isArray(app.communityLinks) ? app.communityLinks.length : 0;
  if (links > 0) filled++;
  return Math.min(10, filled * 2); // 5 fields × 2 = max 10
}

/**
 * Derive community links score (0–10) based on number and quality of links.
 */
function deriveCommunityLinksScore(app: { communityLinks?: unknown }): number {
  const links = Array.isArray(app.communityLinks) ? app.communityLinks : [];
  return Math.min(10, links.length * 3);
}

/**
 * Calculate total score for an application using the given weights.
 */
export function calculateTotalScore(
  app: {
    testScore: number;
    protocolDescription: string;
    communityBenefit: string;
    firstThirtyDays: string;
    twitterHandle?: string | null;
    telegramHandle?: string | null;
    githubHandle?: string | null;
    otherLinks?: string | null;
    communityLinks?: unknown;
    isEvangelist: number;
    xContentScore: number;
    xEngagementScore: number;
    xConsistencyScore: number;
    communityContribScore: number;
    tgActivityScore: number;
    adminOverrideScore: number;
  },
  weights = AMBASSADOR_WEIGHTS
): number {
  const answerDepth = deriveAnswerDepth(app);
  const completeness = deriveCompleteness(app);
  const communityLinksScore = deriveCommunityLinksScore(app);
  const evangelistBonus = app.isEvangelist === 1 ? 10 : 0;

  const raw =
    app.testScore * weights.testScore +
    answerDepth * weights.answerDepth +
    completeness * weights.completeness +
    communityLinksScore * weights.communityLinks +
    evangelistBonus * weights.evangelistBonus +
    app.xContentScore * weights.xContentScore +
    app.xEngagementScore * weights.xEngagementScore +
    app.xConsistencyScore * weights.xConsistencyScore +
    app.communityContribScore * weights.communityContribScore +
    app.tgActivityScore * weights.tgActivityScore;

  // Each weight × 10 = max 10 pts per signal; total max = 10 × sum(weights) = 10
  // Multiply by 10 to get a 0–100 scale
  const score = raw * 10 + app.adminOverrideScore;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Calculate which badges an applicant has earned.
 */
export function calculateBadges(app: {
  testScore: number;
  xContentScore: number;
  xEngagementScore: number;
  xConsistencyScore: number;
  communityContribScore: number;
  tgActivityScore: number;
  communityLinks?: unknown;
  evangelistCandidate: number;
  protocolDescription: string;
  communityBenefit: string;
  firstThirtyDays: string;
}): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (app.testScore >= 8) badges.push("knowledgeable");
  if (app.testScore === 10) badges.push("perfect_score");
  if (deriveAnswerDepth(app) >= 7) badges.push("articulate");
  if (app.xConsistencyScore >= 7) badges.push("consistent");
  if (app.communityContribScore >= 7) badges.push("community_builder");
  if (app.communityContribScore >= 5 && app.tgActivityScore >= 5) badges.push("amplifier");
  if (app.xContentScore >= 7) badges.push("creator");
  if (app.xEngagementScore >= 7) badges.push("high_reach");
  const links = Array.isArray(app.communityLinks) ? app.communityLinks.length : 0;
  if (links >= 2) badges.push("network_embedded");
  if (app.evangelistCandidate === 1) badges.push("evangelist_candidate");
  return badges;
}

/**
 * Update scores, badges, trend, and totalScore for an application.
 */
export async function updateApplicationScores(
  id: number,
  scores: {
    xContentScore?: number;
    xEngagementScore?: number;
    xConsistencyScore?: number;
    communityContribScore?: number;
    tgActivityScore?: number;
    adminOverrideScore?: number;
    level?: number;
    evangelistCandidate?: number;
    fraudFlag?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch current record
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, id))
    .limit(1);
  if (!result.length) throw new Error("Application not found");
  const current = result[0];

  const merged = {
    ...current,
    ...scores,
  };

  const newTotal = calculateTotalScore(merged);
  const newBadges = calculateBadges(merged);

  // Compute trend from weekly scores
  const weekly: { week: string; score: number }[] = Array.isArray(current.weeklyScores)
    ? (current.weeklyScores as { week: string; score: number }[])
    : [];

  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, "0")}`;
  const updatedWeekly = [...weekly.filter(w => w.week !== weekKey), { week: weekKey, score: newTotal }]
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8); // keep last 8 weeks

  let trend = 0;
  if (updatedWeekly.length >= 2) {
    const last = updatedWeekly[updatedWeekly.length - 1].score;
    const prev = updatedWeekly[updatedWeekly.length - 2].score;
    if (last > prev + 1) trend = 1;
    else if (last < prev - 1) trend = -1;
  }

  // Diff old vs new badges and prepare badge_events inserts
  const prevBadges: string[] = Array.isArray(current.badges) ? (current.badges as string[]) : [];
  const prevSet = new Set<string>(prevBadges);
  const newSet = new Set<string>(newBadges as string[]);
  const badgeEventRows: { applicationId: number; badgeKey: string; eventType: "awarded" | "dormant" | "reactivated" | "override_active" | "override_dormant"; scoreAtEvent: number }[] = [];
  Array.from(newSet).forEach((key) => {
    if (!prevSet.has(key)) {
      // Badge newly earned
      badgeEventRows.push({ applicationId: id, badgeKey: key, eventType: "awarded", scoreAtEvent: newTotal });
    }
  });
  Array.from(prevSet).forEach((key) => {
    if (!newSet.has(key)) {
      // Badge lost
      badgeEventRows.push({ applicationId: id, badgeKey: key, eventType: "dormant", scoreAtEvent: newTotal });
    }
  });

  await db
    .update(ambassadorApplications)
    .set({
      ...scores,
      totalScore: newTotal,
      badges: newBadges,
      weeklyScores: updatedWeekly,
      scoreTrend: trend,
      scoreUpdatedAt: new Date(),
    })
    .where(eq(ambassadorApplications.id, id));

  // Write badge events after the score update
  for (const evt of badgeEventRows) {
    await db.insert(badgeEvents).values(evt);
  }
}

/**
 * Get ranked leaderboard — sorted by lifetimeXp descending (Build Bible v1.2).
 * lifetimeXp is the canonical ranking column (unbounded, never decays).
 * evangelistMode: if true, re-ranks by lifetimeXp but highlights top 12 for Token2049 shortlist.
 */
export async function getRankedLeaderboard(evangelistMode = false) {
  const db = await getDb();
  if (!db) return [];
  // Default sort: Lifetime XP (Build Bible v1.2 ledger system).
  // Tiebreaker: xp30day for ambassadors with equal lifetime score.
  const rows = await db
    .select()
    .from(ambassadorApplications)
    .where(and(
      or(
        isNull(ambassadorApplications.twitterHandle),
        notInArray(ambassadorApplications.twitterHandle, [...EXCLUDED_HANDLES])
      ),
      eq(ambassadorApplications.hideFromLeaderboard, 0)
    ))
    .orderBy(desc(ambassadorApplications.lifetimeXp), desc(ambassadorApplications.xp30day));
  if (!evangelistMode) return scrubAmbassadors(rows);
  // Evangelist mode: same XP ranking but attach evangelistScore = lifetimeXp for display
  return rows
    .map(row => ({
      ...scrubAmbassador(row),
      evangelistScore: row.lifetimeXp ?? row.totalXP ?? 0,
    }))
    .sort((a, b) => b.evangelistScore - a.evangelistScore);
}

// ── JOURNAL ENTRIES ──────────────────────────────────────────────────────────
export async function getJournalEntries(applicationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journalEntries)
    .where(eq(journalEntries.applicationId, applicationId))
    .orderBy(desc(journalEntries.createdAt));
}

export async function createJournalEntry(data: {
  applicationId: number;
  entryType: "plan" | "journal";
  title: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(journalEntries).values(data);
  return { id: (result as any).insertId };
}

export async function updateJournalEntry(id: number, applicationId: number, data: {
  title?: string;
  content?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(journalEntries)
    .set(data)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.applicationId, applicationId)));
}

export async function deleteJournalEntry(id: number, applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.applicationId, applicationId)));
}

// ── PUBLIC LEADERBOARD ───────────────────────────────────────────────────────
export async function getPublicLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: ambassadorApplications.id,
    displayHandle: ambassadorApplications.displayHandle,
    twitterHandle: ambassadorApplications.twitterHandle,
    telegramHandle: ambassadorApplications.telegramHandle,
    avatarUrl: ambassadorApplications.avatarUrl,
    tracks: ambassadorApplications.tracks,
    level: ambassadorApplications.level,
    evangelistCandidate: ambassadorApplications.evangelistCandidate,
    totalScore: ambassadorApplications.totalScore,
    totalXP: ambassadorApplications.totalXP,
    lifetimeXp: ambassadorApplications.lifetimeXp,
    xp30day: ambassadorApplications.xp30day,
    xp90day: ambassadorApplications.xp90day,
    currentTier: ambassadorApplications.currentTier,
    tierStepDownAt: ambassadorApplications.tierStepDownAt,
    isFounding: ambassadorApplications.isFounding,
    xpTier: ambassadorApplications.xpTier,
    isSolitaire: ambassadorApplications.isSolitaire,
    xpTrend: ambassadorApplications.xpTrend,
    scoreTrend: ambassadorApplications.scoreTrend,
    badges: ambassadorApplications.badges,
    isEvangelist: ambassadorApplications.isEvangelist,
    xContentScore: ambassadorApplications.xContentScore,
    xEngagementScore: ambassadorApplications.xEngagementScore,
    xConsistencyScore: ambassadorApplications.xConsistencyScore,
    communityContribScore: ambassadorApplications.communityContribScore,
    tgActivityScore: ambassadorApplications.tgActivityScore,
    testScore: ambassadorApplications.testScore,
    xpC1: ambassadorApplications.xpC1,
    xpC2: ambassadorApplications.xpC2,
    xpC3: ambassadorApplications.xpC3,
    xpC4: ambassadorApplications.xpC4,
    xpC5: ambassadorApplications.xpC5,
    xpC6: ambassadorApplications.xpC6,
    xpC7: ambassadorApplications.xpC7,
    xpC8: ambassadorApplications.xpC8,
    xpC9: ambassadorApplications.xpC9,
    xpC10: ambassadorApplications.xpC10,
    xpC11: ambassadorApplications.xpC11,
    status: ambassadorApplications.status,
  }).from(ambassadorApplications)
    .where(and(
      gte(ambassadorApplications.level, 1),
      lte(ambassadorApplications.level, 2),
      or(
        isNull(ambassadorApplications.twitterHandle),
        notInArray(ambassadorApplications.twitterHandle, [...EXCLUDED_HANDLES])
      )
    ))
    // Default sort: Lifetime XP (Build Bible v1.2 ledger system).
    // Tiebreaker: xp30day for ambassadors with equal lifetime score.
    .orderBy(desc(ambassadorApplications.lifetimeXp), desc(ambassadorApplications.xp30day));

  // Fetch active badges for every ambassador in one pass and zip them onto
  // each row. This is the source of truth for badge display — frontend code
  // should not re-derive badges from raw XP thresholds.
  const badgeRows = await db
    .select({
      applicationId: ambassadorBadges.applicationId,
      badgeKey: ambassadorBadges.badgeKey,
    })
    .from(ambassadorBadges)
    .where(eq(ambassadorBadges.status, "active"));
  const byApp = new Map<number, string[]>();
  for (const r of badgeRows) {
    const list = byApp.get(r.applicationId) ?? [];
    list.push(r.badgeKey);
    byApp.set(r.applicationId, list);
  }
  return rows.map((row) => ({ ...row, activeBadges: byApp.get(row.id) ?? [] }));
}

export async function getPublicProfile(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({
    id: ambassadorApplications.id,
    displayHandle: ambassadorApplications.displayHandle,
    twitterHandle: ambassadorApplications.twitterHandle,
    telegramHandle: ambassadorApplications.telegramHandle,
    avatarUrl: ambassadorApplications.avatarUrl,
    tracks: ambassadorApplications.tracks,
    level: ambassadorApplications.level,
    evangelistCandidate: ambassadorApplications.evangelistCandidate,
    totalScore: ambassadorApplications.totalScore,
    totalXP: ambassadorApplications.totalXP,
    lifetimeXp: ambassadorApplications.lifetimeXp,
    xp30day: ambassadorApplications.xp30day,
    xp90day: ambassadorApplications.xp90day,
    currentTier: ambassadorApplications.currentTier,
    tierStepDownAt: ambassadorApplications.tierStepDownAt,
    isFounding: ambassadorApplications.isFounding,
    scoreTrend: ambassadorApplications.scoreTrend,
    badges: ambassadorApplications.badges,
    xContentScore: ambassadorApplications.xContentScore,
    xEngagementScore: ambassadorApplications.xEngagementScore,
    xConsistencyScore: ambassadorApplications.xConsistencyScore,
    communityContribScore: ambassadorApplications.communityContribScore,
    tgActivityScore: ambassadorApplications.tgActivityScore,
    testScore: ambassadorApplications.testScore,
    weeklyScores: ambassadorApplications.weeklyScores,
    status: ambassadorApplications.status,
  }).from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, id));
  return row ?? null;
}

// Get own application by email (for personal dashboard)
export async function getApplicationByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(ambassadorApplications)
    .where(eq(ambassadorApplications.email, email))
    .orderBy(desc(ambassadorApplications.createdAt))
    .limit(1);
  return row ?? null;
}

// ── TELEGRAM TRACKER HELPERS ─────────────────────────────────────────────────
export async function getTelegramBatches() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(telegramBatches)
    .orderBy(desc(telegramBatches.uploadedAt));
}

export async function getTelegramUnmatchedSenders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ senderDisplayName: telegramActivity.telegramHandle })
    .from(telegramActivity)
    .where(isNull(telegramActivity.applicationId));
  return rows.map((r) => r.senderDisplayName);
}

export async function getTelegramMappingStatus(applicationId: number): Promise<{ isMapped: boolean; displayName: string | null; messageCount: number }> {
  const db = await getDb();
  if (!db) return { isMapped: false, displayName: null, messageCount: 0 };
  const rows = await db
    .select({ telegramHandle: telegramActivity.telegramHandle })
    .from(telegramActivity)
    .where(eq(telegramActivity.applicationId, applicationId));
  if (rows.length === 0) return { isMapped: false, displayName: null, messageCount: 0 };
  return { isMapped: true, displayName: rows[0].telegramHandle, messageCount: rows.length };
}

export async function getXMappingStatus(applicationId: number): Promise<{ isMapped: boolean; tweetCount: number; lastScrapedAt: number | null }> {
  const db = await getDb();
  if (!db) return { isMapped: false, tweetCount: 0, lastScrapedAt: null };
  // Get tweet count from x_activity
  const [row] = await db.execute(
    `SELECT COUNT(*) as cnt FROM x_activity WHERE applicationId = ${applicationId}`
  ) as any;
  const cnt = Number(row?.[0]?.cnt ?? 0);
  // Get lastScrapedAt from the ambassador record (stamped after every scrape run)
  const [appRow] = await db
    .select({ lastScrapedAt: ambassadorApplications.lastScrapedAt })
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, applicationId));
  const lastScrapedAt = appRow?.lastScrapedAt ? new Date(appRow.lastScrapedAt).getTime() : null;
  return { isMapped: cnt > 0, tweetCount: cnt, lastScrapedAt };
}

export async function getTelegramActivitySummary() {
  const db = await getDb();
  if (!db) return [];

  // Single SQL query: aggregate message counts per ambassador in the DB
  const rows = await db.execute(sql`
    SELECT
      t.applicationId,
      a.twitterHandle,
      a.telegramHandle,
      MIN(t.telegramHandle)                        AS displayName,
      COUNT(*)                                     AS messageCount,
      COALESCE(SUM(t.messageType = 'reply'), 0)    AS replyCount,
      COALESCE(SUM(t.messageType = 'forward'), 0)  AS forwardCount,
      MAX(t.sentAt)                                AS lastMessageAt
    FROM telegram_activity t
    JOIN ambassador_applications a ON a.id = t.applicationId
    WHERE t.applicationId IS NOT NULL
    GROUP BY t.applicationId, a.twitterHandle, a.telegramHandle
    ORDER BY messageCount DESC
  `);

  const data = Array.isArray((rows as unknown[][])[0]) ? (rows as unknown[][])[0] : rows;
  return (data as Record<string, unknown>[]).map((r) => ({
    applicationId: Number(r.applicationId),
    twitterHandle: r.twitterHandle ? String(r.twitterHandle) : null,
    telegramHandle: r.telegramHandle ? String(r.telegramHandle) : null,
    displayName: String(r.displayName),
    messageCount: Number(r.messageCount),
    replyCount: Number(r.replyCount),
    forwardCount: Number(r.forwardCount),
    lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt as string) : null,
  }));
}

// ── FEATURED POSTS ────────────────────────────────────────────────────────────

export async function getFeaturedPostsByAmbassador(applicationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(featuredPosts)
    .where(eq(featuredPosts.applicationId, applicationId))
    .orderBy(featuredPosts.position);
}

export async function getAllFeaturedPosts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(featuredPosts)
    .orderBy(featuredPosts.position);
}

export async function upsertFeaturedPost(data: {
  id?: number;
  applicationId: number;
  tweetUrl: string;
  caption?: string | null;
  position: number;
  adminNote?: string | null;
  isVisible?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    await db
      .update(featuredPosts)
      .set({
        tweetUrl: data.tweetUrl,
        caption: data.caption ?? null,
        position: data.position,
        adminNote: data.adminNote ?? null,
        isVisible: data.isVisible ?? 1,
      })
      .where(eq(featuredPosts.id, data.id));
    return data.id;
  }
  const result = await db.insert(featuredPosts).values({
    applicationId: data.applicationId,
    tweetUrl: data.tweetUrl,
    caption: data.caption ?? null,
    position: data.position,
    adminNote: data.adminNote ?? null,
    isVisible: data.isVisible ?? 1,
  });
  return (result[0] as { insertId: number }).insertId;
}

export async function deleteFeaturedPost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(featuredPosts).where(eq(featuredPosts.id, id));
}

export async function reorderFeaturedPosts(
  applicationId: number,
  orderedIds: number[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(featuredPosts)
      .set({ position: i + 1 })
      .where(
        and(
          eq(featuredPosts.id, orderedIds[i]),
          eq(featuredPosts.applicationId, applicationId)
        )
      );
  }
}

// ── HANDLE LOOKUP (public, no auth) ──────────────────────────────────────────
// Returns full ambassador profile by twitterHandle (case-insensitive)
export async function getAmbassadorByHandle(handle: string) {
  const db = await getDb();
  if (!db) return null;
  const clean = handle.replace(/^@/, "").toLowerCase();
  const [row] = await db.select().from(ambassadorApplications)
    .where(sql`LOWER(REPLACE(twitterHandle, '@', '')) = ${clean}`)
    .limit(1);
  return row ? scrubAmbassador(row) : null;
}

// Get rank context: position on leaderboard, XP gap to prev/next
export async function getRankContext(applicationId: number) {
  const db = await getDb();
  if (!db) return null;
  // Ranked by 30-Day XP — mirrors the default leaderboard sort (Bible 10.3).
  const rows = await db.select({
    id: ambassadorApplications.id,
    xp30day: ambassadorApplications.xp30day,
    lifetimeXp: ambassadorApplications.lifetimeXp,
    twitterHandle: ambassadorApplications.twitterHandle,
  }).from(ambassadorApplications)
    .where(and(
      gte(ambassadorApplications.level, 1),
      or(
        isNull(ambassadorApplications.twitterHandle),
        notInArray(ambassadorApplications.twitterHandle, [...EXCLUDED_HANDLES])
      )
    ))
    .orderBy(desc(ambassadorApplications.xp30day));
  const idx = rows.findIndex((r) => r.id === applicationId);
  if (idx === -1) return null;
  const position = idx + 1;
  const total = rows.length;
  const above = idx > 0 ? rows[idx - 1] : null;
  const below = idx < rows.length - 1 ? rows[idx + 1] : null;
  const myXP = rows[idx].xp30day;
  return {
    position,
    total,
    lifetimeXp: rows[idx].lifetimeXp,
    xpGapAbove: above ? above.xp30day - myXP : null,
    handleAbove: above?.twitterHandle ?? null,
    xpGapBelow: below ? myXP - below.xp30day : null,
    handleBelow: below?.twitterHandle ?? null,
  };
}

// Community-wide Lifetime XP progress toward the Founding-tier close
// (Build Bible Part 8: collective threshold 5,000,000 OR 100 seats filled).
export async function getCommunityXpProgress() {
  const db = await getDb();
  const fallback = {
    total: 0,
    threshold: 5_000_000,
    seatCap: 100,
    seatsFilled: 0,
    closed: false,
  };
  if (!db) return fallback;
  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ambassadorApplications.lifetimeXp}), 0)` })
    .from(ambassadorApplications)
    .where(or(
      isNull(ambassadorApplications.twitterHandle),
      notInArray(ambassadorApplications.twitterHandle, [...EXCLUDED_HANDLES])
    ));
  const [cfg] = await db.select().from(foundingConfig).limit(1);
  return {
    total: Number(total ?? 0),
    threshold: Number(cfg?.collectiveThreshold ?? 5_000_000),
    seatCap: cfg?.seatCap ?? 100,
    seatsFilled: cfg?.seatsFilled ?? 0,
    closed: !!cfg?.closedAt,
  };
}

// Update wallet address for an ambassador
export async function updateWalletAddress(applicationId: number, walletAddress: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ambassadorApplications)
    .set({ walletAddress })
    .where(eq(ambassadorApplications.id, applicationId));
}

// ── BUILDER SUBMISSIONS ───────────────────────────────────────────────────────
export async function getBuilderSubmissions(applicationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(builderSubmissions)
    .where(eq(builderSubmissions.applicationId, applicationId))
    .orderBy(desc(builderSubmissions.submittedAt));
}

export async function createBuilderSubmission(data: {
  applicationId: number;
  url: string;
  submissionType: "integration" | "repository" | "article" | "tutorial" | "event" | "introduction" | "translation" | "bug_report" | "other";
  title: string;
  description?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(builderSubmissions).values({
    applicationId: data.applicationId,
    url: data.url,
    submissionType: data.submissionType,
    title: data.title,
    description: data.description ?? null,
    status: "pending",
  });
  return (result[0] as { insertId: number }).insertId;
}

export async function deleteBuilderSubmission(id: number, applicationId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(builderSubmissions)
    .where(and(eq(builderSubmissions.id, id), eq(builderSubmissions.applicationId, applicationId)));
}

export async function getAllBuilderSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(builderSubmissions)
    .orderBy(desc(builderSubmissions.submittedAt));
}

// ── TELEGRAM CLAIM FLOW ───────────────────────────────────────────────────────

/** Find an application by claimedByTgOpenId (fast lookup on repeat logins) */
export async function getApplicationByClaimedTgOpenId(tgOpenId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.claimedByTgOpenId, tgOpenId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/** Find an application by X/Twitter handle (normalized, for claim matching) */
export async function getApplicationByTwitterHandleClaim(handle: string) {
  const db = await getDb();
  if (!db) return null;
  const clean = handle.replace(/^@/, "").toLowerCase().trim();
  const result = await db
    .select()
    .from(ambassadorApplications)
    .where(
      sql`LOWER(REPLACE(${ambassadorApplications.twitterHandle}, '@', '')) = ${clean}`
    )
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/** Permanently link a Telegram OpenID to an application */
export async function claimApplicationByTgOpenId(applicationId: number, tgOpenId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Claim is provisional: claimPending=1 blocks AI/tier benefits until an
  // admin confirms ownership in the admin panel (security: prevents claiming
  // a high-XP application to inherit its compute credits).
  await db
    .update(ambassadorApplications)
    .set({ claimedByTgOpenId: tgOpenId, claimPending: 1 })
    .where(eq(ambassadorApplications.id, applicationId));
}

export async function confirmClaim(applicationId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(ambassadorApplications)
    .set({ claimPending: 0 })
    .where(eq(ambassadorApplications.id, applicationId));
}

/**
 * List applications that are unclaimed (no claimedByTgOpenId) with pending/approved status.
 * Returns minimal fields for the "pick from list" UI.
 */
export async function listUnclaimedApplications() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: ambassadorApplications.id,
      twitterHandle: ambassadorApplications.twitterHandle,
      telegramHandle: ambassadorApplications.telegramHandle,
      displayHandle: ambassadorApplications.displayHandle,
      tracks: ambassadorApplications.tracks,
      status: ambassadorApplications.status,
    })
    .from(ambassadorApplications)
    .where(
      and(
        isNull(ambassadorApplications.claimedByTgOpenId),
        sql`${ambassadorApplications.status} IN ('pending', 'approved')`
      )
    )
    .orderBy(ambassadorApplications.id);
  return rows;
}
