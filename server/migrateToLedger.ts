/**
 * Build Bible v1.2 Part 5 — one-time freeze-and-carry migration.
 *
 * Nobody is reset. Each existing ambassador's current displayed balance is
 * read once and written as a single 'migration_opening_balance' ledger
 * event. All new XP accrues as per-action events on top of it.
 *
 * Idempotent: source_ref = 'migration-<application_id>' + the uq_dedupe
 * key mean re-running cannot double the opening balance.
 *
 * Operational sequencing (Bible 5.2): the legacy scoring cron is frozen
 * (Build Step 6 decommission) — but because this migration is idempotent
 * and additive, running it before or after that freeze is safe.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, ne, sql } from "drizzle-orm";
import { ambassadorApplications, xpEvents } from "../drizzle/schema";
import { awardXp, recomputeXpCaches } from "./xpLedger";

function getDb() {
  return drizzle(process.env.DATABASE_URL!);
}

export async function runOpeningBalanceMigration(): Promise<{
  ambassadors: number;
  totalCarried: number;
  sample: Array<{ id: number; opening: number; lifetimeAfter: number }>;
}> {
  const db = getDb();
  const apps = await db
    .select({
      id: ambassadorApplications.id,
      lifetimeXp: ambassadorApplications.lifetimeXp,
      totalXP: ambassadorApplications.totalXP,
    })
    .from(ambassadorApplications);

  let totalCarried = 0;
  const sample: Array<{ id: number; opening: number; lifetimeAfter: number }> =
    [];

  for (const a of apps) {
    // The displayed accumulated balance: prefer the unbounded lifetime
    // accumulator if it carries a value, else the legacy 0–100 score.
    // The legacy 0–100 number itself is never replayed (Bible 5.3).
    const opening = Math.max(
      0,
      Math.round(Number(a.lifetimeXp ?? 0) || Number(a.totalXP ?? 0)),
    );

    await awardXp({
      applicationId: a.id,
      eventType: "migration_opening_balance",
      source: "migration",
      sourceRef: `migration-${a.id}`,
      amount: opening, // explicit so a 0 still writes one row per ambassador
    });

    const { lifetime } = await recomputeXpCaches(a.id);
    totalCarried += opening;
    if (sample.length < 40)
      sample.push({ id: a.id, opening, lifetimeAfter: lifetime });
  }

  return { ambassadors: apps.length, totalCarried, sample };
}

/**
 * Verification (Bible 5.2 step 6): for every ambassador that has ONLY the
 * opening-balance event (no per-action events ingested yet), cached
 * lifetime_xp must equal that opening event's amount. Returns mismatches.
 */
export async function verifyMigration(): Promise<
  Array<{ id: number; opening: number; lifetime: number; otherEvents: number }>
> {
  const db = getDb();
  const apps = await db
    .select({
      id: ambassadorApplications.id,
      lifetime: ambassadorApplications.lifetimeXp,
    })
    .from(ambassadorApplications);
  const bad: Array<{
    id: number;
    opening: number;
    lifetime: number;
    otherEvents: number;
  }> = [];
  for (const a of apps) {
    const [open] = await db
      .select({ amt: xpEvents.xpAmount })
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.applicationId, a.id),
          eq(xpEvents.eventType, "migration_opening_balance"),
        ),
      )
      .limit(1);
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.applicationId, a.id),
          ne(xpEvents.eventType, "migration_opening_balance"),
        ),
      );
    const opening = Number(open?.amt ?? 0);
    const otherEvents = Number(cnt ?? 0);
    const lifetime = Number(a.lifetime ?? 0);
    if (otherEvents === 0 && lifetime !== opening)
      bad.push({ id: a.id, opening, lifetime, otherEvents });
  }
  return bad;
}
