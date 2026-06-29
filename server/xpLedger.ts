/**
 * Ambassador XP Engine — Build Bible v1.2 (Part 4).
 *
 * Per-action append-only ledger. Lifetime XP = SUM(xp_events.xp_amount).
 * Only ever increases (the sole exception is an admin 'gaming_reversal'
 * negative row, Part 4.5). No 0–100 score, no C1–C11, no decay, no
 * daily-earn formula — those belong to the legacy engine being retired.
 *
 * This module is the seam's downstream replacement: it consumes the SAME
 * raw activity rows the (untouched) scrapers already write.
 */

import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  ambassadorApplications,
  xActivity,
  telegramActivity,
  xpEvents,
} from "../drizzle/schema";
import { getDb } from "./db";

// ── EARN VALUES (Build Bible Part 4.2 / 4.3) — single source of truth ────────
export const EARN = {
  // Content & Advocacy (X) — engagement GIVEN
  post: 50,
  thread: 150,
  reply: 10,
  quote: 15,
  repost: 5,
  // Engagement RECEIVED on own posts
  received_repost: 30,
  received_quote: 40,
  received_reply: 20,
  // Growth mechanics (gated — Part 4.2 precondition / Build Step 15)
  a2a_amplify: 25,
  a2a_author_bonus: 15,
  showcase_reply: 8,
  showcase_received_repost: 20,
  showcase_received_quote: 25,
  showcase_received_reply: 12,
  // Community (Telegram & real-world)
  tg_message: 5,
  community_help_newcomer: 100,
  community_flag_resolved: 50,
  community_session: 500,
  community_event: 500,
  // Building (human-reviewed)
  build_integration: 2000,
  build_repo: 1500,
  build_article: 1000,
  build_tutorial: 1000,
  build_intro: 500,
  build_translation: 400,
  build_bugfix: 300,
  // Protocol App (on-chain)
  app_first_swap: 100,
  app_swap: 10,
  app_first_send: 150,
  app_send: 10,
  app_referral_swap: 100,
  app_p2p_trade: 20,
  // Onboarding quests (once per account)
  quest_apply_pass_test: 200,
  quest_test_8plus: 100,
  quest_test_perfect: 200,
  quest_connect_x: 100,
  quest_connect_tg: 100,
  quest_first_post: 100,
  quest_first_swap: 100,
  quest_first_send: 100,
  quest_first_referral: 100,
  quest_first_build_approved: 200,
  // Community referrals (Part 4.3)
  community_referral: 75,
  community_referral_quality: 150,
} as const;

export type EarnEvent = keyof typeof EARN;

/**
 * Award one XP event. Idempotent: the UNIQUE(event_type, source_ref) key
 * makes a repeated (eventType, sourceRef) a silent no-op — re-running
 * ingestion never double-awards. Pass an explicit amount only for
 * admin/quest/gaming-reversal rows whose value is not a fixed EARN constant.
 */
export async function awardXp(opts: {
  applicationId: number;
  eventType: string;
  source: string;
  sourceRef: string;
  amount?: number;
}): Promise<void> {
  const amount =
    opts.amount ?? EARN[opts.eventType as EarnEvent] ?? 0;
  if (amount === 0 && opts.amount === undefined) return;
  const db = await getDb();
  if (!db) return;
  try {
    // Attempt standard insert with no-op duplicate handling.
    await db
      .insert(xpEvents)
      .values({
        applicationId: opts.applicationId,
        eventType: opts.eventType,
        xpAmount: amount,
        source: opts.source,
        sourceRef: opts.sourceRef,
      })
      .onDuplicateKeyUpdate({
        set: { applicationId: sql`application_id` },
      });
  } catch {
    // Silently swallow all errors (duplicate key, constraint violations, etc.).
    // Re-running ingestion is idempotent — the row either exists or will be
    // inserted on the next successful run. The cron must never crash here.
  }
}

/** Recompute the cached lifetime / 30-day / 90-day sums from the ledger. */
export async function recomputeXpCaches(applicationId: number): Promise<{
  lifetime: number;
  d30: number;
  d90: number;
}> {
  const db = await getDb();
  if (!db) return { lifetime: 0, d30: 0, d90: 0 };
  const [row] = await db
    .select({
      lifetime: sql<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)`,
      d30: sql<number>`COALESCE(SUM(CASE WHEN ${xpEvents.awardedAt} >= NOW() - INTERVAL 30 DAY THEN ${xpEvents.xpAmount} ELSE 0 END), 0)`,
      d90: sql<number>`COALESCE(SUM(CASE WHEN ${xpEvents.awardedAt} >= NOW() - INTERVAL 90 DAY THEN ${xpEvents.xpAmount} ELSE 0 END), 0)`,
    })
    .from(xpEvents)
    .where(eq(xpEvents.applicationId, applicationId));
  const lifetime = Math.max(0, Number(row?.lifetime ?? 0));
  const d30 = Math.max(0, Number(row?.d30 ?? 0));
  const d90 = Math.max(0, Number(row?.d90 ?? 0));
  await db
    .update(ambassadorApplications)
    .set({ lifetimeXp: lifetime, xp30day: d30, xp90day: d90 })
    .where(eq(ambassadorApplications.id, applicationId));
  return { lifetime, d30, d90 };
}

// ── INGESTION: raw activity → ledger ─────────────────────────────────────────
// Maps the rows the scrapers already write into immutable XP events. Stable
// source_ref = the platform's own id (tweetId / messageId) so re-ingestion
// is idempotent via uq_dedupe.
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │ CAVEAT — GROWTH-MECHANIC XP IS ENABLED WITHOUT THE DETECTION LAYER.    │
// │ Build Bible Part 4.2 / Part 12 step 15 make authenticity-weighting +  │
// │ cluster-detection a HARD launch gate before A2A / showcase /          │
// │ received-engagement may earn ("do not ship the growth-mechanic XP     │
// │ without this … MUST be live"). That gate has been EXPLICITLY          │
// │ OVERRIDDEN by the named program owner (their documented decision      │
// │ right per the Bible's "owner decides" clause). Farming risk is        │
// │ knowingly accepted. This is reversible: flip the single switch below  │
// │ back to false to re-gate instantly.                                   │
// └───────────────────────────────────────────────────────────────────────┘
const ENABLE_UNVERIFIED_GROWTH = true; // OWNER OVERRIDE — detection layer is OFF

// Base pipeline-aware mapping. The scraper tags each row:
//   outbound       = the ambassador's OWN protocol timeline content
//   inbound_official   = engagement the ambassador GAVE on official protocol content
//   inbound_mention= a reply under a 3rd-party account that mentions the protocol
//                    (the showcase-reply growth mechanic)
function mapXRow(pipeline: string, tweetType: string): EarnEvent | null {
  if (pipeline === "outbound") {
    if (tweetType === "post") return "post"; // original protocol post
    return null;
  }
  if (pipeline === "inbound_official") {
    if (tweetType === "reply") return "reply";
    if (tweetType === "quote") return "quote";
    if (tweetType === "retweet") return "repost";
    return null;
  }
  return null; // inbound_mention handled as showcase below (when enabled)
}

function cleanHandle(h: string | null | undefined): string {
  return (h ?? "").trim().toLowerCase().replace(/^@+/, "");
}

export async function ingestXActivityToLedger(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Registry of registered ambassadors (handle → application id) for A2A
  // detection — engaging another *ambassador's* protocol content is the
  // higher-value event (Bible 4.2).
  const reg = ENABLE_UNVERIFIED_GROWTH
    ? await db
        .select({
          id: ambassadorApplications.id,
          handle: ambassadorApplications.twitterHandle,
        })
        .from(ambassadorApplications)
        .where(gte(ambassadorApplications.level, 1))
    : [];
  const idByHandle = new Map<string, number>();
  for (const a of reg) {
    const h = cleanHandle(a.handle);
    if (h) idByHandle.set(h, a.id);
  }

  const rows = await db
    .select({
      applicationId: xActivity.applicationId,
      tweetId: xActivity.tweetId,
      tweetType: xActivity.tweetType,
      pipeline: xActivity.pipeline,
      quotedFrom: xActivity.quotedFrom,
      retweets: xActivity.retweets,
      replies: xActivity.replies,
      quotes: xActivity.quotes,
    })
    .from(xActivity)
    .where(isNotNull(xActivity.applicationId));

  let n = 0;
  for (const r of rows) {
    if (r.applicationId == null) continue;

    // 1. Base content/advocacy.
    const evt = mapXRow(r.pipeline, r.tweetType);
    if (evt) {
      await awardXp({
        applicationId: r.applicationId,
        eventType: evt,
        source: "x_scraper",
        sourceRef: r.tweetId,
      });
      n++;
    }

    if (!ENABLE_UNVERIFIED_GROWTH) continue;

    // 2. Showcase reply — a reply under a 3rd-party account mentioning the protocol.
    if (r.pipeline === "inbound_mention" && r.tweetType === "reply") {
      await awardXp({
        applicationId: r.applicationId,
        eventType: "showcase_reply",
        source: "x_scraper",
        sourceRef: `showcase-${r.tweetId}`,
      });
      n++;
    }

    // 3. Ambassador-to-ambassador amplification — quoting / reposting a
    //    registered ambassador's protocol content. Both sides earn (Bible 4.2).
    //    Detectable via quotedFrom (replies have no parent-handle column).
    const targetHandle = cleanHandle(r.quotedFrom);
    const targetId = targetHandle ? idByHandle.get(targetHandle) : undefined;
    if (
      targetId &&
      targetId !== r.applicationId &&
      (r.tweetType === "quote" || r.tweetType === "retweet")
    ) {
      await awardXp({
        applicationId: r.applicationId,
        eventType: "a2a_amplify",
        source: "x_scraper",
        sourceRef: `a2a-${r.tweetId}`,
      });
      await awardXp({
        applicationId: targetId,
        eventType: "a2a_author_bonus",
        source: "x_scraper",
        sourceRef: `a2ab-${r.tweetId}`,
      });
      n += 2;
    }

    // 4. Received engagement on the ambassador's OWN posts. First-sight
    //    snapshot keyed by tweet (idempotent). NOTE: without the gated
    //    weighting layer this does not live-increment and is farmable —
    //    accepted per the owner override above.
    if (r.pipeline === "outbound" && r.tweetType === "post") {
      const amount =
        Number(r.retweets ?? 0) * EARN.received_repost +
        Number(r.quotes ?? 0) * EARN.received_quote +
        Number(r.replies ?? 0) * EARN.received_reply;
      if (amount > 0) {
        await awardXp({
          applicationId: r.applicationId,
          eventType: "received_engagement",
          source: "x_scraper",
          sourceRef: `recv-${r.tweetId}`,
          amount,
        });
        n++;
      }
    }
  }
  return n;
}

const TG_MIN_WORDS = 5;

export async function ingestTelegramToLedger(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({
      applicationId: telegramActivity.applicationId,
      messageId: telegramActivity.messageId,
      text: telegramActivity.text,
    })
    .from(telegramActivity)
    .where(isNotNull(telegramActivity.applicationId));
  let n = 0;
  for (const r of rows) {
    if (r.applicationId == null) continue;
    const words = (r.text ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length < TG_MIN_WORDS) continue; // substantive only (Part 4.2)
    await awardXp({
      applicationId: r.applicationId,
      eventType: "tg_message",
      source: "tg_scraper",
      sourceRef: r.messageId,
    });
    n++;
  }
  return n;
}

/**
 * Admin gaming-reversal (Part 4.5). NOT decay. A new negative ledger row
 * pointing at the original event id(s). Admin-only; nothing automatic
 * calls this.
 */
export async function reverseXp(opts: {
  applicationId: number;
  reversedEventId: number;
  amount: number; // negative
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(xpEvents)
    .values({
      applicationId: opts.applicationId,
      eventType: "gaming_reversal",
      xpAmount: -Math.abs(opts.amount),
      source: "admin",
      sourceRef: `reversal-${opts.reversedEventId}`,
    })
    .onDuplicateKeyUpdate({
      // Idempotent: this original event was already reversed.
      set: { applicationId: sql`application_id` },
    });
}
