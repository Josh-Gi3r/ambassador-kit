/**
 * Build Bible v1.2 Part 4.3 — community referrals.
 *
 * Each ambassador has a deterministic referral code (no extra column —
 * derived from the application id, stable and unique). v1 attribution is
 * a manual weekly admin sweep: paste (code, joiner) pairs; each confirmed
 * row writes ONE idempotent `community_referral` event (75 XP) to the
 * referrer. The /refer bot auto-attribution is a noted later upgrade.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { ambassadorApplications } from "../drizzle/schema";
import { awardXp } from "./xpLedger";

const PREFIX = process.env.REFERRAL_PREFIX ?? "AMB-";

export function referralCodeFor(applicationId: number): string {
  return PREFIX + applicationId.toString(36).toUpperCase();
}

export function applicationIdFromCode(code: string): number | null {
  const raw = code.trim().toUpperCase().replace(PREFIX, "");
  const id = parseInt(raw, 36);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Weekly sweep. `entries` = confirmed (referralCode, joiner) pairs read
 * from the new-joiner tags. `joiner` is any stable identifier for the new
 * person (their Telegram handle) — it is the dedupe key, so a joiner can
 * only ever credit one referral even if the sweep is re-run.
 */
export async function runReferralSweep(
  entries: Array<{ referralCode: string; joiner: string }>,
): Promise<{ credited: number; skipped: number }> {
  const db = drizzle(process.env.DATABASE_URL!);
  let credited = 0;
  let skipped = 0;
  for (const e of entries) {
    const referrerId = applicationIdFromCode(e.referralCode);
    const joiner = e.joiner.trim().toLowerCase().replace(/^@/, "");
    if (!referrerId || !joiner) {
      skipped++;
      continue;
    }
    const [ref] = await db
      .select({ id: ambassadorApplications.id })
      .from(ambassadorApplications)
      .where(eq(ambassadorApplications.id, referrerId))
      .limit(1);
    if (!ref) {
      skipped++;
      continue;
    }
    await awardXp({
      applicationId: referrerId,
      eventType: "community_referral",
      source: "referral_sweep",
      sourceRef: `refsweep-${joiner}`, // one credit per joiner, ever
    });
    credited++;
  }
  return { credited, skipped };
}
