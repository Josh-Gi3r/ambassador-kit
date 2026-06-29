// ── BADGE ENGINE ──────────────────────────────────────────────────────────────
// Computes badge eligibility for a single ambassador and updates ambassador_badges.
// Called after every score update (XP recalc, admin score save, Apify refresh).
// Evangelist badge is EXCLUDED — admin-only toggle.

import { getDb } from "./db";
import { ambassadorBadges, badgeEvents, ambassadorApplications, type AmbassadorApplication } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const GRACE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

// ── THRESHOLD CHECKS ─────────────────────────────────────────────────────────

// ISO week key (e.g. "2026-W11") for a given date, used to bucket daily snapshots
// into the weekly view that the rising badge spec talks about. Exported for
// unit tests; this is pure.
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Snapshots are written daily by xpEngine.addXPSnapshot(); collapse to one
// per ISO week (latest snapshot wins) so the rising streak check actually
// reflects weekly progress instead of three consecutive days.
function toWeeklySnapshots(snaps: Array<{ date: string; xp: number }>): Array<{ week: string; xp: number }> {
  const byWeek = new Map<string, { date: string; xp: number }>();
  for (const s of snaps) {
    const parsed = new Date(s.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = isoWeekKey(parsed);
    const existing = byWeek.get(key);
    if (!existing || s.date > existing.date) byWeek.set(key, s);
  }
  return Array.from(byWeek.entries())
    .map(([week, s]) => ({ week, xp: s.xp }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Exported for unit tests; pure given the application row.
export function checkEligibility(app: AmbassadorApplication): Record<string, boolean> {
  // Build Bible 10.2 — badge inputs re-pointed off the deleted C-components.
  // Consistency / engagement / momentum read the ledger-derived caches
  // (xp_30day = "active now", xp_90day = sustained). Content/community/
  // builder remain admin-awarded (their admin raw scores still exist and
  // are set in the admin panel — they were never the computed XP).
  const d30 = Number((app as any).xp30day ?? 0);
  const d90 = Number((app as any).xp90day ?? 0);

  return {
    l1_contributor: (app.level ?? 0) >= 1,
    l2_ambassador: app.status === "approved", // L2 = admin approval
    // evangelist: manual only — excluded (admin grant, Part 8A)
    steady_hand: d30 >= 300,    // light-but-real recent activity
    iron_rhythm: d30 >= 1200,   // Active-tier pace sustained over 30d
    wordsmith: app.c4ContentQuality >= 7,
    viral_voice: d30 >= 600,    // engagement given, ledger-derived
    shipper: app.c7BuilderOutput >= 4,
    architect: app.c8BuilderDepth >= 8,
    first_responder: app.c6CommunityValue >= 7,
    community_pillar: app.c6CommunityValue >= 9,
    sharp: app.testScore >= 8,
    perfect: app.testScore >= 10,
    // Momentum: recent 30d outpacing the older two-thirds of the 90d window.
    rising: d30 > 0 && d30 * 2 > (d90 - d30),
  };
}

// ── MAIN ENGINE ───────────────────────────────────────────────────────────────

export async function computeBadgesForAmbassador(applicationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Load application
  const [app] = await db
    .select()
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, applicationId))
    .limit(1);
  if (!app) return;

  const eligible = checkEligibility(app);
  const now = new Date();

  // Load existing badge rows
  const existing = await db
    .select()
    .from(ambassadorBadges)
    .where(eq(ambassadorBadges.applicationId, applicationId));

  const existingMap = Object.fromEntries(existing.map((b: typeof existing[0]) => [b.badgeKey, b]));

  // Keys to process (excludes evangelist)
  const keys = Object.keys(eligible);

  for (const key of keys) {
    const isEligible = eligible[key];
    const row = existingMap[key];

    // Permanent badges (l1_contributor, sharp, perfect): award once, never go dormant
    const isPermanent = ["l1_contributor", "sharp", "perfect"].includes(key);
    // Rising: no grace window
    const noGrace = key === "rising";

    if (!row) {
      // No row yet — create it
      if (isEligible) {
        await db.insert(ambassadorBadges).values({
          applicationId,
          badgeKey: key,
          status: "active",
          awardedAt: now,
          scoreAtChange: getScoreForBadge(app, key),
        });
        await db.insert(badgeEvents).values({
          applicationId,
          badgeKey: key,
          eventType: "awarded",
          scoreAtEvent: getScoreForBadge(app, key),
        });
      } else {
        await db.insert(ambassadorBadges).values({
          applicationId,
          badgeKey: key,
          status: "locked",
        });
      }
      continue;
    }

    // Row exists
    if (isEligible) {
      if (row.status === "locked" || row.status === "dormant") {
        // Award or re-activate
        await db
          .update(ambassadorBadges)
          .set({
            status: "active",
            awardedAt: row.awardedAt ?? now,
            dormantAt: null,
            graceWindowEnd: null,
            scoreAtChange: getScoreForBadge(app, key),
          })
          .where(eq(ambassadorBadges.id, row.id));
        await db.insert(badgeEvents).values({
          applicationId,
          badgeKey: key,
          eventType: row.status === "dormant" ? "reactivated" : "awarded",
          scoreAtEvent: getScoreForBadge(app, key),
        });
      } else if (row.status === "active" && row.graceWindowEnd) {
        // Was in grace window but score recovered — cancel grace
        await db
          .update(ambassadorBadges)
          .set({ graceWindowEnd: null, dormantAt: null })
          .where(eq(ambassadorBadges.id, row.id));
      }
    } else {
      // Not eligible
      if (isPermanent) continue; // Permanent badges never go dormant

      if (row.status === "active") {
        if (noGrace) {
          // Rising: go dormant immediately
          await db
            .update(ambassadorBadges)
            .set({ status: "dormant", dormantAt: now, graceWindowEnd: null })
            .where(eq(ambassadorBadges.id, row.id));
          await db.insert(badgeEvents).values({
            applicationId,
            badgeKey: key,
            eventType: "dormant",
            scoreAtEvent: getScoreForBadge(app, key),
          });
        } else if (!row.graceWindowEnd) {
          // Start 14-day grace window
          const graceEnd = new Date(now.getTime() + GRACE_DAYS * MS_PER_DAY);
          await db
            .update(ambassadorBadges)
            .set({ graceWindowEnd: graceEnd })
            .where(eq(ambassadorBadges.id, row.id));
        } else if (now > row.graceWindowEnd) {
          // Grace window expired — go dormant
          await db
            .update(ambassadorBadges)
            .set({ status: "dormant", dormantAt: now, graceWindowEnd: null })
            .where(eq(ambassadorBadges.id, row.id));
          await db.insert(badgeEvents).values({
            applicationId,
            badgeKey: key,
            eventType: "dormant",
            scoreAtEvent: getScoreForBadge(app, key),
          });
        }
        // else: still in grace window — do nothing
      }
    }
  }
}

function getScoreForBadge(app: AmbassadorApplication, key: string): number {
  switch (key) {
    case "l1_contributor": return app.level ?? 0;
    case "l2_ambassador": return app.totalXP;
    case "steady_hand":
    case "iron_rhythm": return app.xpC2;
    case "wordsmith": return app.c4ContentQuality;
    case "viral_voice": return app.xpC3 ?? 0;
    case "shipper": return app.c7BuilderOutput;
    case "architect": return app.c8BuilderDepth;
    case "first_responder":
    case "community_pillar": return app.c6CommunityValue;
    case "sharp":
    case "perfect": return app.testScore;
    case "rising": return app.totalXP;
    default: return 0;
  }
}

/** Get active badge keys for an ambassador (for leaderboard display) */
export async function getActiveBadgeKeys(applicationId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ badgeKey: ambassadorBadges.badgeKey })
    .from(ambassadorBadges)
    .where(
      and(
        eq(ambassadorBadges.applicationId, applicationId),
        eq(ambassadorBadges.status, "active")
      )
    );
  return rows.map((r: { badgeKey: string }) => r.badgeKey);
}

/** Get all badge rows for an ambassador (for profile/admin display) */
export async function getAllBadgeRows(applicationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ambassadorBadges)
    .where(eq(ambassadorBadges.applicationId, applicationId));
}
