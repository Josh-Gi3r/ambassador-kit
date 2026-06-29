/**
 * X (Twitter) Activity Scraper
 * Uses Apify's tweet scraper to pull posts, replies, quotes, and retweets
 * from each ambassador's X account related to configured brand keywords.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, isNotNull, and, desc, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ambassadorApplications, xActivity, xScrapeRuns, XActivity } from "../drizzle/schema";
import { recalculateAllXP } from "./xpEngine";
import { isBrandRelated } from "./shared/brandFilter";
import { callDataApi } from "./_core/dataApi";

function getDb() {
  return drizzle(process.env.DATABASE_URL!);
}

import { ENV } from "./_core/env";
import { BRAND_OFFICIAL_HANDLES, PROGRAM_START_DATE as _PROGRAM_START_DATE } from "./config/brand";
const APIFY_API_KEY = ENV.apifyApiKey;

/**
 * S9 — keep the Apify token out of fetch URLs (where it would leak into
 * error logs / proxies). All Apify calls go through this helper which puts
 * the token in the Authorization header instead.
 */
function apifyFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${APIFY_API_KEY}`,
    },
  });
}


const ACTOR_ID = ENV.scraperActorId;

const UNLIMITED_ACTOR_ID = ENV.scraperUnlimitedActorId;
// Absolute floor — we never scrape before this date
const PROGRAM_START_DATE = _PROGRAM_START_DATE;

/**
 * Get the start date for scraping a given ambassador.
 * - If they have never been scraped: use PROGRAM_START_DATE
 * - If they have been scraped before: use the date of their most recent completed scrape run
 *   (so we only fetch new posts since then)
 */
async function getStartDateForAmbassador(applicationId: number): Promise<string> {
  const db = getDb();
  const runs = await db
    .select({ completedAt: xScrapeRuns.completedAt })
    .from(xScrapeRuns)
    .where(
      and(
        eq(xScrapeRuns.applicationId, applicationId),
        eq(xScrapeRuns.status, "completed")
      )
    )
    .orderBy(desc(xScrapeRuns.completedAt))
    .limit(1);

  if (runs.length > 0 && runs[0].completedAt) {
    // Go back 1 day from last scrape to avoid missing tweets at boundary
    const d = new Date(runs[0].completedAt);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  return PROGRAM_START_DATE;
}

/**
 * Determine tweet type from Apify tweet object
 */
function getTweetType(tweet: Record<string, unknown>): "post" | "reply" | "quote" | "retweet" {
  if (tweet.isRetweet) return "retweet";
  if (tweet.isQuote) return "quote";
  if (tweet.inReplyToStatusId || tweet.inReplyToUserId) return "reply";
  return "post";
}

// Keyword filtering and search query building are handled by server/shared/brandFilter.ts
// Do NOT add keyword logic here — use isBrandRelated() and buildAmbassadorSearchQueries() from that module.

// External data API timeline fetch removed — twitterHandles via Apify covers all tweet types including X Articles.
// isBrandRelated() is applied client-side to filter results.

async function runApifyActor(
  searchTerms: string[],
  startDate: string | null,
  options?: { twitterHandles?: string[]; startUrls?: string[]; maxItems?: number }
): Promise<Record<string, unknown>[]> {

  // Build actor input — searchTerms always included; twitterHandles captures X Articles
  const actorInput: Record<string, unknown> = {
    searchTerms,
    maxItems: options?.maxItems ?? 200,
    queryType: "Latest",
    lang: "",
    includeSearchTerms: false,
  };
  // Only set global since if explicitly provided — when searchTerms already contain
  // per-query since: dates, do NOT set a global since (it overrides the per-query dates)
  if (startDate) {
    actorInput.since = startDate;
  }
  if (options?.twitterHandles?.length) {
    // twitterHandles fetches the full profile timeline including X Articles
    // which are NOT indexed in Twitter search and thus invisible to searchTerms alone
    actorInput.twitterHandles = options.twitterHandles;
  }
  if (options?.startUrls?.length) {
    actorInput.startUrls = options.startUrls.map((url) => ({ url }));
  }

  // Start the actor run
  const startRes = await apifyFetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Apify start failed: ${startRes.status} ${err}`);
  }

  const startData = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };
  const runId = startData.data.id;
  const datasetId = startData.data.defaultDatasetId;

  // Poll for completion (max 3 minutes)
  const maxWait = 180_000;
  const pollInterval = 5_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await apifyFetch(
      `https://api.apify.com/v2/actor-runs/${runId}`
    );
    const statusData = (await statusRes.json()) as { data: { status: string } };
    const status = statusData.data.status;

    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status} for run ${runId}`);
    }
  }

  // Fetch results from dataset — limit must cover bulk runs (67 ambassadors × 200 tweets = up to 13,400)
  const dataRes = await apifyFetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?limit=20000`
  );
  const items = (await dataRes.json()) as Record<string, unknown>[];
  return items;
}

/**
 * Scrape X activity for a single ambassador and store results.
 * @param fromDate - Optional override for the start date (YYYY-MM-DD). If provided, ignores last scrape history.
 */
export async function scrapeAmbassadorX(applicationId: number, fromDate?: string): Promise<{
  tweetCount: number;
  runId: number;
}> {
  const db = getDb();

  // Get the ambassador's X handle
  const [app] = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(eq(ambassadorApplications.id, applicationId));

  if (!app?.twitterHandle) {
    throw new Error(`Ambassador ${applicationId} has no Twitter handle`);
  }

  // Create a scrape run record
  const [runRecord] = await db
    .insert(xScrapeRuns)
    .values({ applicationId, status: "running" })
    .$returningId();
  const runId = runRecord.id;

  try {
    // Use provided fromDate override, or compute from last scrape history
    const startDate = fromDate ?? await getStartDateForAmbassador(applicationId);
    const cleanHandle = app.twitterHandle.replace(/^@/, "").replace(/^https?:\/\/x\.com\//, "");

    // Single source: twitterHandles timeline fetch via Apify.
    // This fetches the ambassador's full profile timeline (including X Articles)
    // since the last scrape date. isBrandRelated() filters using configured brand keywords.
    // No search queries needed — twitterHandles covers everything.
    const rawTweets = await runApifyActor([], startDate, { twitterHandles: [cleanHandle], maxItems: 500 });

    // Deduplicate by tweetId and filter for brand relevance.
    // Skip articles (text is empty or very short) — articles are handled qualitatively by admins.
    const seen = new Set<string>();
    const filteredTweets = rawTweets.filter((tweet) => {
      const id = String(tweet.id || tweet.tweetId || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      const text = String(tweet.text || tweet.fullText || "");
      // Skip articles (no meaningful text to filter on)
      if (!text || text.trim().length < 10) return false;
      // Keep only protocol-related tweets
      return isBrandRelated(text);
    });

    // Upsert by tweetId — insert new rows, update engagement metrics on existing ones
    let inserted = 0;
    for (const tweet of filteredTweets) {
      const tweetId = String(tweet.id || tweet.tweetId || "");
      if (!tweetId) continue;

      const postedAt = tweet.createdAt
        ? new Date(tweet.createdAt as string)
        : new Date();

      const tweetType = getTweetType(tweet);

      // Extract quoted/retweeted author handle
      let quotedFrom: string | null = null;
      if (tweetType === "retweet" || tweetType === "quote") {
        const retweetedUser = (tweet.retweetedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
        const quotedUser = (tweet.quotedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
        const author = retweetedUser?.screen_name || quotedUser?.screen_name || null;
        quotedFrom = author ? String(author) : null;
      }

      const values = {
        applicationId,
        tweetId,
        tweetType,
        text: String(tweet.text || tweet.fullText || ""),
        likes: Number(tweet.likeCount || tweet.favoriteCount || 0),
        retweets: Number(tweet.retweetCount || 0),
        replies: Number(tweet.replyCount || 0),
        quotes: Number(tweet.quoteCount || tweet.quote_count || tweet.quotes || 0),
        bookmarks: Number(tweet.bookmarkCount || 0),
        quotedFrom,
        tweetUrl: tweet.url ? String(tweet.url) : `https://x.com/i/web/status/${tweetId}`,
        postedAt,
      };

      // ON DUPLICATE KEY UPDATE — update engagement metrics but preserve original postedAt
      await db
        .insert(xActivity)
        .values(values)
        .onDuplicateKeyUpdate({
          set: {
            likes: values.likes,
            retweets: values.retweets,
            replies: values.replies,
            quotes: values.quotes,
            bookmarks: values.bookmarks,
            scrapedAt: sql`NOW()`,
          },
        });
      inserted++;
    }

    // Mark run as completed
    await db
      .update(xScrapeRuns)
      .set({ status: "completed", tweetCount: inserted, completedAt: new Date() })
      .where(eq(xScrapeRuns.id, runId));

    return { tweetCount: inserted, runId };
  } catch (err) {
    // Mark run as failed
    await db
      .update(xScrapeRuns)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(xScrapeRuns.id, runId));
    throw err;
  }
}

// In-memory job state for background scrape-all jobs
type ScrapeAllJob = {
  jobId: string;
  status: "running" | "completed" | "failed";
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  totalTweets: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
};

const scrapeJobs = new Map<string, ScrapeAllJob>();

export function getScrapeJob(jobId: string): ScrapeAllJob | undefined {
  return scrapeJobs.get(jobId);
}

/**
 * Start scraping all ambassadors in a SINGLE bulk Apify run.
 *
 * Architecture (MASTER.md Section 15, Pipeline 1 — SCRAPING_SPEC_VERSION: 7.0):
 * - Build one searchTerms array: ["from:handle1 since:YYYY-MM-DD", "from:handle2 since:YYYY-MM-DD", ...]
 * - Fire ONE Apify run with all handles simultaneously
 * - Parse results by tweet.author.userName to map back to ambassador IDs
 * - Apply isBrandRelated() filter to each tweet text
 * - Upsert into x_activity with pipeline = 'outbound'
 *
 * Why searchTerms instead of twitterHandles:
 * - The Apify actor's `start`/`end` date params only work with searchTerms, NOT twitterHandles.
 * - Using "from:handle since:date" in searchTerms gives us date-filtered results per ambassador.
 * - One actor run for all ambassadors vs N sequential runs — massively cheaper and faster.
 *
 * @param fromDate - Optional override start date (YYYY-MM-DD). Defaults to each ambassador's last scrape date.
 *                   Pass PROGRAM_START_DATE for a full clean scrape from the beginning.
 * Returns immediately with a jobId — poll getScrapeJob(jobId) for progress.
 */
export async function scrapeAllAmbassadorsX(fromDate?: string): Promise<{ jobId: string; total: number }> {
  const db = getDb();

  const ambassadors = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(isNotNull(ambassadorApplications.twitterHandle));

  const validAmbassadors = ambassadors.filter((a) => !!a.twitterHandle);

  const jobId = `scrape-all-${Date.now()}`;
  const job: ScrapeAllJob = {
    jobId,
    status: "running",
    total: validAmbassadors.length,
    done: 0,
    succeeded: 0,
    failed: 0,
    totalTweets: 0,
    startedAt: new Date(),
  };
  scrapeJobs.set(jobId, job);

  // Run in background — do NOT await
  (async () => {
    try {
      // ── Step 1: Determine the since date for each ambassador ──────────────────
      // If fromDate is provided (full clean scrape), use it for everyone.
      // Otherwise, use each ambassador's individual last-scrape date.
      const handleToId = new Map<string, number>();
      const searchTerms: string[] = [];

      for (const ambassador of validAmbassadors) {
        const cleanHandle = ambassador.twitterHandle!.replace(/^@/, "").replace(/^https?:\/\/x\.com\//, "");
        handleToId.set(cleanHandle.toLowerCase(), ambassador.id);

        const since = fromDate ?? await getStartDateForAmbassador(ambassador.id);
        // Twitter advanced search: from:handle since:YYYY-MM-DD
        searchTerms.push(`from:${cleanHandle} since:${since}`);
      }

      console.log(`[ScrapeAll] Firing single Apify run for ${searchTerms.length} ambassadors...`);

      // ── Step 2: Create a bulk scrape run record ───────────────────────────────
      const [runRecord] = await db
        .insert(xScrapeRuns)
        .values({ applicationId: null, status: "running" })
        .$returningId();
      const bulkRunId = runRecord.id;

      // ── Step 3: Single Apify run — all handles in one call ───────────────────
      // maxItems is per-query, so set high enough to capture all tweets per ambassador.
      // The actor runs all searchTerms in parallel internally.
      let rawTweets: Record<string, unknown>[] = [];
      try {
        // Pass null for startDate — each searchTerm already has "since:YYYY-MM-DD" baked in.
        // Passing a global since would override the per-query dates and cause the actor
        // to start from PROGRAM_START_DATE for all queries, missing recent tweets.
        rawTweets = await runApifyActor(searchTerms, null, {
          maxItems: Math.min(searchTerms.length * 200, 10000),
        });
        console.log(`[ScrapeAll] Apify returned ${rawTweets.length} raw tweets`);
      } catch (apifyErr) {
        await db
          .update(xScrapeRuns)
          .set({ status: "failed", errorMessage: apifyErr instanceof Error ? apifyErr.message : String(apifyErr), completedAt: new Date() })
          .where(eq(xScrapeRuns.id, bulkRunId));
        throw apifyErr;
      }

      // ── Step 4: Parse results by author handle, filter, and store ─────────────
      // Track per-ambassador tweet counts for job progress reporting
      const ambassadorTweetCounts = new Map<number, number>();
      const seen = new Set<string>();
      let totalInserted = 0;

      for (const tweet of rawTweets) {
        const tweetId = String(tweet.id || tweet.tweetId || "");
        if (!tweetId || seen.has(tweetId)) continue;
        seen.add(tweetId);

        // Resolve author handle → ambassador ID
        const authorHandle = String(
          (tweet.author as Record<string, unknown>)?.userName ||
          (tweet.author as Record<string, unknown>)?.username ||
          (tweet.user as Record<string, unknown>)?.screen_name ||
          tweet.authorHandle ||
          tweet.username ||
          ""
        ).toLowerCase().replace(/^@/, "");

        if (!authorHandle) continue;
        const ambassadorId = handleToId.get(authorHandle);
        if (!ambassadorId) continue; // Tweet from unknown handle — skip

        const text = String(tweet.text || tweet.fullText || "");

        // Skip articles (no meaningful text)
        if (!text || text.trim().length < 10) continue;

        // Apply brand relevance filter
        if (!isBrandRelated(text)) continue;

        const postedAt = tweet.createdAt ? new Date(tweet.createdAt as string) : new Date();
        const tweetType = getTweetType(tweet);

        let quotedFrom: string | null = null;
        if (tweetType === "retweet" || tweetType === "quote") {
          const retweetedUser = (tweet.retweetedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
          const quotedUser = (tweet.quotedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
          const author = retweetedUser?.screen_name || quotedUser?.screen_name || null;
          quotedFrom = author ? String(author) : null;
        }

        await db
          .insert(xActivity)
          .values({
            applicationId: ambassadorId,
            tweetId,
            tweetType,
            text,
            likes: Number(tweet.likeCount || tweet.favoriteCount || 0),
            retweets: Number(tweet.retweetCount || 0),
            replies: Number(tweet.replyCount || 0),
            quotes: Number(tweet.quoteCount || tweet.quote_count || tweet.quotes || 0),
            bookmarks: Number(tweet.bookmarkCount || 0),
            quotedFrom,
            tweetUrl: tweet.url ? String(tweet.url) : `https://x.com/i/web/status/${tweetId}`,
            postedAt,
            pipeline: "outbound",
          })
          .onDuplicateKeyUpdate({
            set: {
              likes: sql`VALUES(likes)`,
              retweets: sql`VALUES(retweets)`,
              replies: sql`VALUES(replies)`,
              quotes: sql`VALUES(quotes)`,
              bookmarks: sql`VALUES(bookmarks)`,
              scrapedAt: sql`NOW()`,
            },
          });

        ambassadorTweetCounts.set(ambassadorId, (ambassadorTweetCounts.get(ambassadorId) ?? 0) + 1);
        totalInserted++;
      }

      // ── Step 5: Mark bulk run as completed ────────────────────────────────────
      await db
        .update(xScrapeRuns)
        .set({ status: "completed", tweetCount: totalInserted, completedAt: new Date() })
        .where(eq(xScrapeRuns.id, bulkRunId));

      // Update job progress — all ambassadors done in one shot
      job.totalTweets = totalInserted;
      job.succeeded = validAmbassadors.length;
      job.done = validAmbassadors.length;

      console.log(`[ScrapeAll] Done: ${totalInserted} tweets stored across ${ambassadorTweetCounts.size} ambassadors`);

      // ── Step 6: Stamp lastScrapedAt on all scraped ambassadors ────────────────
      try {
        const now = new Date();
        await db
          .update(ambassadorApplications)
          .set({ lastScrapedAt: now })
          .where(isNotNull(ambassadorApplications.twitterHandle));
        console.log(`[ScrapeAll] lastScrapedAt stamped for ${validAmbassadors.length} ambassadors`);
      } catch (stampErr) {
        console.error('[ScrapeAll] lastScrapedAt stamp failed:', stampErr);
      }
      // ── Step 7: Recalculate XP for all ambassadors ────────────────────────────
      try {
        const updated = await recalculateAllXP();
        console.log(`[ScrapeAll] XP recalculated for ${updated} ambassadors`);
      } catch (xpErr) {
        console.error('[ScrapeAll] XP recalculation failed:', xpErr);
      }

    } catch (err) {
      job.failed = validAmbassadors.length - job.succeeded;
      job.error = err instanceof Error ? err.message : String(err);
      console.error('[ScrapeAll] Fatal error:', job.error);
    }

    job.status = job.failed > 0 && job.succeeded === 0 ? "failed" : "completed";
    job.completedAt = new Date();
    // Clean up old jobs after 1 hour
    setTimeout(() => scrapeJobs.delete(jobId), 3_600_000);
  })().catch((err) => {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    job.completedAt = new Date();
  });

  return { jobId, total: validAmbassadors.length };
}

export type XActivitySummary = {
  applicationId: number;
  twitterHandle: string;
  postCount: number;
  replyCount: number;
  quoteCount: number;
  retweetCount: number;
  totalRetweets: number;
  totalReplies: number;
  totalBookmarks: number;
  lastScraped: Date | null;
  lastTweetAt: Date | null;
};

/**
 * Get X activity summary for all ambassadors (for admin dashboard)
 */
export async function getXActivitySummary(): Promise<XActivitySummary[]> {
  const db = getDb();

  // Single SQL query: aggregate x_activity per ambassador.
  // NOTE: x_scrape_runs is intentionally NOT joined here — joining it would
  // multiply tweet rows (one per run) and cause double-counting of SUM(likes) etc.
  // lastScraped is fetched via a correlated subquery instead.
  const rows = await db.execute(sql`
    SELECT
      a.id                                                          AS applicationId,
      a.twitterHandle,
      COALESCE(SUM(x.tweetType = 'post'),      0)                  AS postCount,
      COALESCE(SUM(x.tweetType = 'reply'),     0)                  AS replyCount,
      COALESCE(SUM(x.tweetType = 'quote'),     0)                  AS quoteCount,
      COALESCE(SUM(x.tweetType = 'retweet'),   0)                  AS retweetCount,
      -- Exclude retweets from retweets/replies/bookmarks to avoid inflating stats
      -- with engagement from the original viral post.
      -- NOTE: Likes are NOT tracked (Twitter API does not expose who liked a tweet)
      COALESCE(SUM(CASE WHEN x.tweetType != 'retweet' THEN x.retweets  ELSE 0 END), 0) AS totalRetweets,
      COALESCE(SUM(CASE WHEN x.tweetType != 'retweet' THEN x.replies   ELSE 0 END), 0) AS totalReplies,
      COALESCE(SUM(CASE WHEN x.tweetType != 'retweet' THEN x.bookmarks ELSE 0 END), 0) AS totalBookmarks,
      a.lastScrapedAt                                               AS lastScraped,
      MAX(x.postedAt)                                              AS lastTweetAt
    FROM ambassador_applications a
    LEFT JOIN x_activity x ON x.applicationId = a.id
    WHERE a.twitterHandle IS NOT NULL
    GROUP BY a.id, a.twitterHandle
    ORDER BY (postCount + replyCount + quoteCount + retweetCount) DESC
  `);

  // mysql2 returns [rows, fields]; drizzle sql`` returns the rows array directly
  const data = Array.isArray((rows as unknown[][])[0]) ? (rows as unknown[][])[0] : rows;

  return (data as Record<string, unknown>[]).map((r) => ({
    applicationId: Number(r.applicationId),
    twitterHandle: String(r.twitterHandle),
    postCount: Number(r.postCount),
    replyCount: Number(r.replyCount),
    quoteCount: Number(r.quoteCount),
    retweetCount: Number(r.retweetCount),
    totalRetweets: Number(r.totalRetweets),
    totalReplies: Number(r.totalReplies),
    totalBookmarks: Number(r.totalBookmarks),
    lastScraped: r.lastScraped ? new Date(r.lastScraped as string) : null,
    lastTweetAt: r.lastTweetAt ? new Date(r.lastTweetAt as string) : null,
  }));
}

/**
 * Get detailed X activity for a single ambassador
 */
export async function getAmbassadorXActivity(applicationId: number): Promise<XActivity[]> {
  const db = getDb();
  return db
    .select()
    .from(xActivity)
    .where(eq(xActivity.applicationId, applicationId))
    .orderBy(desc(xActivity.postedAt));
}


/**
 * Backfill profile photo URLs for all ambassadors with a twitterHandle.
 * Calls Twitter/get_user_profile_by_username for each ambassador,
 * extracts the profile_image_url_https, and saves it to avatarUrl.
 * Uses the full-size image (removes _normal suffix for higher resolution).
 */
export async function backfillAvatarUrls(): Promise<{ updated: number; failed: number; skipped: number }> {
  const db = getDb();
  const ambassadors = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle, avatarUrl: ambassadorApplications.avatarUrl })
    .from(ambassadorApplications)
    .where(isNotNull(ambassadorApplications.twitterHandle));

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const ambassador of ambassadors) {
    if (!ambassador.twitterHandle) { skipped++; continue; }
    try {
      const cleanHandle = ambassador.twitterHandle.replace(/^@/, "");
      const profileData = await callDataApi("Twitter/get_user_profile_by_username", {
        query: { username: cleanHandle },
      }) as Record<string, unknown>;

      // Navigate the nested response to find profile image
      const userResult = (
        (profileData?.result as Record<string, unknown>)?.data as Record<string, unknown>
      )?.user as Record<string, unknown> | undefined;

      const userResultInner = (userResult?.result as Record<string, unknown>) || undefined;

      // Try avatar.image_url first (new API structure), fall back to legacy.profile_image_url_https
      const avatarObj = userResultInner?.avatar as Record<string, unknown> | undefined;
      const avatarImageUrl = avatarObj?.image_url as string | undefined;

      const legacy = (userResultInner?.legacy as Record<string, unknown>) || undefined;
      const legacyImageUrl = legacy?.profile_image_url_https as string | undefined;

      const profileImageUrl = avatarImageUrl || legacyImageUrl;

      if (!profileImageUrl) {
        console.warn(`[backfillAvatarUrls] No profile image found for @${cleanHandle}`);
        failed++;
        continue;
      }

      // Replace _normal with _400x400 for higher resolution
      const highResUrl = profileImageUrl.replace(/_normal(\.\w+)$/, "_400x400$1");

      await db
        .update(ambassadorApplications)
        .set({ avatarUrl: highResUrl })
        .where(eq(ambassadorApplications.id, ambassador.id));

      updated++;
      console.log(`[backfillAvatarUrls] Updated @${cleanHandle}: ${highResUrl}`);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.warn(`[backfillAvatarUrls] Failed for ambassador ${ambassador.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  return { updated, failed, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE 2 — Official Account Timeline Fetch
// SCRAPING_SPEC_VERSION: 7.0 — MASTER.md Section 15, Pipeline 2
//
// Fetches all official-handle posts since last scrape using twitterHandles.
// Stores them as pipeline = 'inbound_official' with applicationId = null.
// These become seed post IDs for Pipeline 3 (conversation tree fetch).
//

// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeOfficialEngagement(sinceDate?: string): Promise<{ postIdsFound: number; totalImported: number }> {
  const db = getDb();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = sinceDate ?? thirtyDaysAgo.toISOString().split("T")[0];

  const [runRecord] = await db
    .insert(xScrapeRuns)
    .values({ applicationId: null, status: "running" })
    .$returningId();
  const runId = runRecord.id;

  try {
    // Fetch the official handle's full timeline since last scrape.
    // All their posts are brand-related by definition — no keyword filter needed.
    //
    // IMPORTANT: The Apify actor's `start`/`end` date params only work with searchTerms,
    // NOT twitterHandles. We use "from:<handle> since:date" in searchTerms to ensure
    // the date filter is actually applied.
    const items = await runApifyActor([`from:${BRAND_OFFICIAL_HANDLES[0]} since:${since}`], since, { maxItems: 500 });
    const sinceDt = new Date(since);
    let imported = 0;

    for (const tweet of items) {
      const tweetId = String(tweet.id || tweet.tweetId || "");
      if (!tweetId) continue;

      const postedAt = tweet.createdAt ? new Date(tweet.createdAt as string) : null;
      if (!postedAt || postedAt < sinceDt) continue;

      const tweetType = getTweetType(tweet);
      const text = String(tweet.text || tweet.fullText || "");
      const tweetUrl = tweet.url ? String(tweet.url) : `https://x.com/i/web/status/${tweetId}`;

      // Store with applicationId = null — these are official handle posts,
      // not ambassador activity. They serve as seed IDs for P3 conversation tree fetch.
      await db
        .insert(xActivity)
        .values({
          applicationId: null,
          tweetId,
          tweetType,
          text,
          likes: Number(tweet.likeCount || tweet.favoriteCount || 0),
          retweets: Number(tweet.retweetCount || 0),
          replies: Number(tweet.replyCount || 0),
          quotes: Number(tweet.quoteCount || tweet.quote_count || tweet.quotes || 0),
          bookmarks: Number(tweet.bookmarkCount || 0),
          quotedFrom: null,
          tweetUrl,
          postedAt,
          pipeline: "inbound_official",
        })
        .onDuplicateKeyUpdate({
          set: {
            likes: sql`VALUES(likes)`,
            retweets: sql`VALUES(retweets)`,
            replies: sql`VALUES(replies)`,
            quotes: sql`VALUES(quotes)`,
            bookmarks: sql`VALUES(bookmarks)`,
            scrapedAt: sql`NOW()`,
          },
        });
      imported++;
    }

    await db
      .update(xScrapeRuns)
      .set({ status: "completed", tweetCount: imported, completedAt: new Date() })
      .where(eq(xScrapeRuns.id, runId));

    console.log(`[Pipeline2] official handle timeline: ${imported} posts stored as seed IDs for P3`);

    // Auto-recalculate XP after P2 completes
    try {
      const updated = await recalculateAllXP();
      console.log(`[Pipeline2] XP recalculated for ${updated} ambassadors`);
    } catch (xpErr) {
      console.error('[Pipeline2] XP recalculation failed:', xpErr);
    }

    return { postIdsFound: imported, totalImported: imported };
  } catch (err) {
    await db
      .update(xScrapeRuns)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() })
      .where(eq(xScrapeRuns.id, runId));
    console.error('[Pipeline2] Failed:', err instanceof Error ? err.message : err);
    throw err;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE 3 — Mention Inward
// SCRAPING_SPEC_VERSION: 6.0 — MASTER.md Section 15, Pipeline 3
//
// Step 1: Search Twitter for third-party posts containing protocol keywords
//         (excluding official handles — those are covered by Pipeline 2)
// Step 2: Collect those third-party post IDs
// Step 3: Pass as conversationIds to twitter-scraper-unlimited to get full thread depth
// Step 4: Match engagers against ambassador handle list
// Step 5: Store matches as pipeline = 'inbound_mention'
//
// The parent post must pass isBrandRelated(). The ambassador's reply/quote/repost
// does NOT need to contain protocol keywords — the parent context is sufficient.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the twitter-scraper-unlimited actor (apidojo~twitter-scraper-lite).
 * This actor supports conversation/reply scraping via the conversationIds input.
 * Uses event-based pricing — no 50-tweet minimum, no restrictions.
 */
async function runUnlimitedApifyActor(
  conversationIds: string[]
): Promise<Record<string, unknown>[]> {
  const actorInput = {
    conversationIds,
    maxItems: Math.min(conversationIds.length * 100, 10000),
    sort: "Latest",
  };

  const startRes = await apifyFetch(
    `https://api.apify.com/v2/acts/${UNLIMITED_ACTOR_ID}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Apify (unlimited) start failed: ${startRes.status} ${err}`);
  }

  const startData = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };
  const runId = startData.data.id;
  const datasetId = startData.data.defaultDatasetId;

  // Poll until done (same pattern as runApifyActor)
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await apifyFetch(
      `https://api.apify.com/v2/actor-runs/${runId}`
    );
    const statusData = (await statusRes.json()) as { data: { status: string } };
    const status = statusData.data?.status;
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify (unlimited) run ${status}: runId=${runId}`);
    }
  }

  // Fetch results
  const itemsRes = await apifyFetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&limit=10000`
  );
  if (!itemsRes.ok) throw new Error(`Apify (unlimited) dataset fetch failed: ${itemsRes.status}`);
  return (await itemsRes.json()) as Record<string, unknown>[];
}

export async function scrapeConversationThreads(): Promise<{ mentionPostsFound: number; totalImported: number }> {
  const db = getDb();

  // Build ambassador handle → id lookup
  const ambassadors = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(isNotNull(ambassadorApplications.twitterHandle));

  const handleToId = new Map<string, number>();
  for (const a of ambassadors) {
    if (a.twitterHandle) {
      handleToId.set(a.twitterHandle.replace(/^@/, "").toLowerCase(), a.id);
    }
  }

  // Step 1: Query x_activity for all distinct tweetIds from P1 (outbound) and P2 (inbound_official)
  // These are the posts we already know are protocol-related — no need for another search.
  // Deduplication is handled by DISTINCT.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log(`[Pipeline3] Querying x_activity for P1+P2 post IDs from the last 30 days...`);
  const sourceRows = await db
    .selectDistinct({ tweetId: xActivity.tweetId })
    .from(xActivity)
    .where(
      and(
        inArray(xActivity.pipeline, ["outbound", "inbound_official"]),
        sql`${xActivity.postedAt} >= ${thirtyDaysAgo}`
      )
    );

  const sourcePostIds = sourceRows
    .map((r) => r.tweetId)
    .filter((id): id is string => !!id);

  console.log(`[Pipeline3] Found ${sourcePostIds.length} source post IDs from P1+P2`);

  if (sourcePostIds.length === 0) {
    console.warn("[Pipeline3] No source posts found in x_activity — run P1 and P2 first");
    return { mentionPostsFound: 0, totalImported: 0 };
  }

  // Batch into chunks of 50 to avoid Apify actor termination on large runs
  const BATCH_SIZE = 50;
  const batches: string[][] = [];
  for (let i = 0; i < sourcePostIds.length; i += BATCH_SIZE) {
    batches.push(sourcePostIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Pipeline3] Processing ${sourcePostIds.length} post IDs in ${batches.length} batches of ${BATCH_SIZE}...`);

  const [runRecord] = await db
    .insert(xScrapeRuns)
    .values({ applicationId: null, status: "running" })
    .$returningId();
  const runId = runRecord.id;

  try {
    let imported = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`[Pipeline3] Batch ${batchIdx + 1}/${batches.length}: fetching ${batch.length} conversation trees...`);

      let items: Record<string, unknown>[];
      try {
        items = await runUnlimitedApifyActor(batch);
      } catch (batchErr) {
        console.error(`[Pipeline3] Batch ${batchIdx + 1} failed:`, batchErr instanceof Error ? batchErr.message : batchErr);
        continue; // skip failed batch, continue with next
      }

      console.log(`[Pipeline3] Batch ${batchIdx + 1}: ${items.length} raw items`);

      // Step 4 & 5: Match engagers against ambassador list and store
      for (const tweet of items) {
        const tweetId = String(tweet.id || tweet.tweetId || "");
        if (!tweetId) continue;

        const postedAt = tweet.createdAt ? new Date(tweet.createdAt as string) : null;
        if (!postedAt) continue;

        // Resolve author handle to ambassador ID
        const authorHandle = String(
          (tweet.author as Record<string, unknown>)?.userName ||
          (tweet.author as Record<string, unknown>)?.username ||
          (tweet.user as Record<string, unknown>)?.screen_name ||
          tweet.authorHandle ||
          tweet.username ||
          ""
        ).toLowerCase().replace(/^@/, "");

        if (!authorHandle) continue;
        const ambassadorId = handleToId.get(authorHandle);
        if (!ambassadorId) continue; // Not a known ambassador — skip

        const tweetType = getTweetType(tweet);
        const text = String(tweet.text || tweet.fullText || "");

        let quotedFrom: string | null = null;
        if (tweetType === "retweet" || tweetType === "quote") {
          const retweetedUser = (tweet.retweetedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
          const quotedUser = (tweet.quotedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
          const author = retweetedUser?.screen_name || quotedUser?.screen_name || null;
          quotedFrom = author ? String(author) : null;
        }

        const tweetUrl = tweet.url
          ? String(tweet.url)
          : `https://x.com/i/web/status/${tweetId}`;

        await db
          .insert(xActivity)
          .values({
            applicationId: ambassadorId,
            tweetId,
            tweetType,
            text,
            likes: Number(tweet.likeCount || tweet.favoriteCount || 0),
            retweets: Number(tweet.retweetCount || 0),
            replies: Number(tweet.replyCount || 0),
            quotes: Number(tweet.quoteCount || tweet.quote_count || tweet.quotes || 0),
            bookmarks: Number(tweet.bookmarkCount || 0),
            quotedFrom,
            tweetUrl,
            postedAt,
            pipeline: "inbound_mention",
          })
          .onDuplicateKeyUpdate({
            set: {
              likes: sql`VALUES(likes)`,
              retweets: sql`VALUES(retweets)`,
              replies: sql`VALUES(replies)`,
              quotes: sql`VALUES(quotes)`,
              bookmarks: sql`VALUES(bookmarks)`,
              scrapedAt: sql`NOW()`,
            },
          });
        imported++;
      } // end for tweet of items
    } // end for batchIdx

    await db
      .update(xScrapeRuns)
      .set({ status: "completed", tweetCount: imported, completedAt: new Date() })
      .where(eq(xScrapeRuns.id, runId));

    console.log(`[Pipeline3] Mention Inward done: ${sourcePostIds.length} source posts scraped, ${imported} ambassador engagements imported`);
    // Auto-recalculate XP for all ambassadors after P3 completes
    try {
      const updated = await recalculateAllXP();
      console.log(`[Pipeline3] XP recalculated for ${updated} ambassadors`);
    } catch (xpErr) {
      console.error('[Pipeline3] XP recalculation failed:', xpErr);
    }
    return { mentionPostsFound: sourcePostIds.length, totalImported: imported };
  } catch (err) {
    await db
      .update(xScrapeRuns)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(xScrapeRuns.id, runId));
    throw err;
  }
}
