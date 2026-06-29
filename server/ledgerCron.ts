/**
 * Build Bible v1.2 Part 7 — the daily cron, exact order of operations.
 *
 * Idempotent end to end: ledger ingestion is deduped by uq_dedupe; tier
 * resolution is a pure function of xp_90day; cached sums are derived;
 * step-down/founding/evangelist transitions only fire on real threshold
 * crossings. Running it twice in a day changes nothing.
 *
 * Runs AFTER the (untouched) scrapers have written raw activity.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, sql } from "drizzle-orm";
import { ambassadorApplications, foundingConfig } from "../drizzle/schema";
import {
  ingestXActivityToLedger,
  ingestTelegramToLedger,
  recomputeXpCaches,
} from "./xpLedger";
import { updateLitellmKeyBudget } from "./ai/litellmAdmin";
import { notifyOwner } from "./_core/notification";

function getDb() {
  return drizzle(process.env.DATABASE_URL!);
}

export type Tier = "initiate" | "active" | "champion" | "elite";
const ORDER: Record<Tier, number> = {
  initiate: 0,
  active: 1,
  champion: 2,
  elite: 3,
};

// Requalification thresholds — trailing-90-day XP (Bible Part 6.1).
const ACTIVE_90 = 1200;
const CHAMPION_90 = 2700;
const ELITE_90 = 3600;
const ELITE_MIN_AGE_DAYS = 90;
const GRACE_DAYS = 14;

/** Pure target-tier resolution from the 90-day window + tenure. */
export function resolveTier(xp90: number, accountAgeDays: number): Tier {
  if (xp90 >= ELITE_90 && accountAgeDays >= ELITE_MIN_AGE_DAYS) return "elite";
  if (xp90 >= CHAMPION_90) return "champion";
  if (xp90 >= ACTIVE_90) return "active";
  return "initiate";
}

function stepDownOne(t: Tier): Tier {
  if (t === "elite") return "champion";
  if (t === "champion") return "active";
  if (t === "active") return "initiate";
  return "initiate";
}

const DAY = 86_400_000;

export async function runLedgerDailyCron(): Promise<{
  ambassadors: number;
  promoted: number;
  steppedDown: number;
  founding: { closed: boolean; seatsFilled: number };
}> {
  const db = getDb();

  // 1. Ingest raw activity → ledger (idempotent).
  // Wrapped in try/catch so a DB error during ingestion never prevents the
  // recomputeXpCaches step below from running.
  try {
    await ingestXActivityToLedger();
  } catch (err) {
    console.warn("[ledgerCron] ingestXActivityToLedger failed (non-fatal):", (err as Error).message);
  }
  try {
    await ingestTelegramToLedger();
  } catch (err) {
    console.warn("[ledgerCron] ingestTelegramToLedger failed (non-fatal):", (err as Error).message);
  }

  const apps = await db
    .select({
      id: ambassadorApplications.id,
      level: ambassadorApplications.level,
      currentTier: ambassadorApplications.currentTier,
      tierStepDownAt: ambassadorApplications.tierStepDownAt,
      accountAgeDays: ambassadorApplications.accountAgeDays,
      createdAt: ambassadorApplications.createdAt,
      fraudFlag: ambassadorApplications.fraudFlag,
      claimPending: ambassadorApplications.claimPending,
      isEvangelist: ambassadorApplications.isEvangelist,
      evangelistStepBackAt: ambassadorApplications.evangelistStepBackAt,
      litellmKey: ambassadorApplications.litellmKey,
    })
    .from(ambassadorApplications);

  const now = Date.now();
  let promoted = 0;
  let steppedDown = 0;

  for (const a of apps) {
    try {
      // 2–3. Recompute cached sums (lifetime / 30d / 90d) from the ledger.
      const { d90 } = await recomputeXpCaches(a.id);

      const ageDays =
        a.accountAgeDays ??
        (a.createdAt
          ? Math.floor((now - new Date(a.createdAt).getTime()) / DAY)
          : 0);

      // 4. Resolve target tier. L0/fraud/pending-claim never leave initiate.
      const blocked =
        Number(a.level ?? 0) < 1 ||
        Number(a.fraudFlag ?? 0) === 1 ||
        Number(a.claimPending ?? 0) === 1;
      const target: Tier = blocked ? "initiate" : resolveTier(d90, ageDays);
      const cur = (a.currentTier ?? "initiate") as Tier;

      const set: Record<string, unknown> = { accountAgeDays: ageDays };
      let newTier: Tier = cur;

      if (ORDER[target] > ORDER[cur]) {
        // 5. Promote immediately; clear any pending step-down.
        newTier = target;
        set.currentTier = target;
        set.tierStepDownAt = null;
        promoted++;
      } else if (ORDER[target] < ORDER[cur]) {
        // 6. Step-down with 14-day grace.
        if (!a.tierStepDownAt) {
          set.tierStepDownAt = new Date(now + GRACE_DAYS * DAY);
          await notifyOwner({
            title: "Tier step-down pending",
            content: `Ambassador ${a.id}: ${cur} access pauses in ${GRACE_DAYS} days unless they post. Lifetime XP and record are untouched.`,
          }).catch(() => {});
        } else if (new Date(a.tierStepDownAt).getTime() <= now) {
          newTier = stepDownOne(cur); // never more than one band
          set.currentTier = newTier;
          set.tierStepDownAt = null;
          steppedDown++;
        }
      } else if (a.tierStepDownAt) {
        // 7. Recovered to ≥ current while a step-down was pending: cancel.
        set.tierStepDownAt = null;
      }

      // 9. Evangelist step-back: held badge but tier below Champion.
      const evTier = (set.currentTier as Tier) ?? cur;
      if (Number(a.isEvangelist ?? 0) === 1) {
        if (ORDER[evTier] < ORDER.champion) {
          if (!a.evangelistStepBackAt) {
            set.evangelistStepBackAt = new Date(now + GRACE_DAYS * DAY);
          } else if (new Date(a.evangelistStepBackAt).getTime() <= now) {
            set.isEvangelist = 0;
            set.evangelistStepBackAt = null;
            await notifyOwner({
              title: "Evangelist badge stepped back",
              content: `Ambassador ${a.id}: tier fell below Champion past the ${GRACE_DAYS}-day grace. Badge cleared. Lifetime XP untouched; the door is never closed.`,
            }).catch(() => {});
          }
        } else if (a.evangelistStepBackAt) {
          set.evangelistStepBackAt = null; // recovered to Champion+
        }
      }

      await db
        .update(ambassadorApplications)
        .set(set)
        .where(eq(ambassadorApplications.id, a.id));

      // Tier-sync the AI key to the new tier, fail-safe to the lower band
      // (Bible 9.6). Best-effort + no-op when LiteLLM is unconfigured.
      // Budget ids == tier names (initiate/active/champion/elite).
      if (a.litellmKey && newTier !== cur) {
        await updateLitellmKeyBudget(a.litellmKey, newTier).catch(() => {});
      }
    } catch (err) {
      console.error(`[ledgerCron] failed for ambassador ${a.id}:`, err);
    }
  }

  // 8. Founding-tier closure check (Bible Part 8).
  const founding = await checkFoundingClosure();

  return { ambassadors: apps.length, promoted, steppedDown, founding };
}

async function checkFoundingClosure(): Promise<{
  closed: boolean;
  seatsFilled: number;
}> {
  const db = getDb();
  let [cfg] = await db.select().from(foundingConfig).limit(1);
  if (!cfg) {
    await db
      .insert(foundingConfig)
      .values({ id: 1 })
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    [cfg] = await db.select().from(foundingConfig).limit(1);
  }
  if (!cfg) return { closed: false, seatsFilled: 0 };
  if (cfg.closedAt)
    return { closed: true, seatsFilled: cfg.seatsFilled ?? 0 };

  const [{ total }] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${ambassadorApplications.lifetimeXp}), 0)`,
    })
    .from(ambassadorApplications);
  const community = Number(total ?? 0);

  // Currently-eligible cohort (Bible 8.1 individual eligibility):
  // lifetime ≥ floor · L1+ · account age ≥ 30d · no fraud/gaming flag ·
  // Telegram auth verified (proxy: a Telegram openid is linked).
  // "Final team confirmation" is an operational, out-of-band step —
  // the Bible 8.3 closure pseudocode itself auto-awards is_founding in the
  // cron, so per-person team sign-off is not schematised here.
  const eligible = await db
    .select({ id: ambassadorApplications.id })
    .from(ambassadorApplications)
    .where(
      and(
        sql`${ambassadorApplications.lifetimeXp} >= ${cfg.individualFloor}`,
        sql`${ambassadorApplications.level} >= 1`,
        sql`${ambassadorApplications.accountAgeDays} >= 30`,
        eq(ambassadorApplications.fraudFlag, 0),
        eq(ambassadorApplications.claimPending, 0),
        sql`${ambassadorApplications.claimedByTgOpenId} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${ambassadorApplications.lifetimeXp} DESC`);

  const thresholdHit = community >= Number(cfg.collectiveThreshold);
  const seatCapHit = eligible.length >= cfg.seatCap;
  if (!thresholdHit && !seatCapHit)
    return { closed: false, seatsFilled: 0 };

  // Close: award up to seat_cap, earliest by lifetime XP, then freeze.
  const winners = eligible.slice(0, cfg.seatCap);
  for (const w of winners) {
    await db
      .update(ambassadorApplications)
      .set({ isFounding: 1 })
      .where(eq(ambassadorApplications.id, w.id));
  }
  await db
    .update(foundingConfig)
    .set({ closedAt: new Date(), seatsFilled: winners.length })
    .where(eq(foundingConfig.id, cfg.id));
  await notifyOwner({
    title: "Founding tier closed",
    content: `Community lifetime XP ${community.toLocaleString()} / threshold ${Number(
      cfg.collectiveThreshold,
    ).toLocaleString()} (seat cap ${cfg.seatCap}). ${winners.length} founding members locked in, forever.`,
  }).catch(() => {});
  return { closed: true, seatsFilled: winners.length };
}
