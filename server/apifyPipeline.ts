/**
 * Apify Pipeline — Webhook-based tweet scraping pipeline
 *
 * Architecture:
 * 1. Admin or scheduler calls startScrapeJob()
 * 2. We fire all Apify runs simultaneously with ad-hoc webhooks
 * 3. Each run fires a POST to /api/webhooks/apify when it completes
 * 4. handleWebhookCallback() imports the dataset, marks the run done
 * 5. When all runs in a job are done → recalculateAllXP()
 *
 * This is fully durable: our server doesn't need to stay awake during scraping.
 * Apify retries webhooks for up to 32 hours if our server is temporarily down.
 *
 * SCRAPING SCOPE — see MASTER.md Section 15 for the definitive rules.
 * Keyword filtering is handled exclusively by server/shared/brandFilter.ts.
 * Do NOT duplicate keyword logic here.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, isNotNull, and, desc, sql } from "drizzle-orm";
import { ambassadorApplications, xActivity } from "../drizzle/schema";
import { recalculateAllXP } from "./xpEngine";
import { isBrandRelated } from "./shared/brandFilter";

function getDb() {
  return drizzle(process.env.DATABASE_URL!);
}

import { ENV } from "./_core/env";
import { BRAND_OFFICIAL_HANDLES, PROGRAM_START_DATE } from "./config/brand";
const APIFY_API_KEY = ENV.apifyApiKey;
const ACTOR_ID = ENV.scraperActorId;

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

// Program start date — never scrape before this


// ── Get per-ambassador scrape start date ──────────────────────────────────────

async function getStartDateForAmbassador(ambassadorId: number): Promise<string> {
  const db = getDb();
  // Find the most recent successfully imported scrape run for this ambassador
  const [row] = await db.execute(
    sql`SELECT completedAt FROM scrape_runs 
        WHERE ambassadorId = ${ambassadorId} AND status = 'imported' 
        ORDER BY completedAt DESC LIMIT 1`
  ) as unknown as [Array<{ completedAt: number | null }>];
  
  if (row && row.length > 0 && row[0].completedAt) {
    // Go back 1 day from last scrape to avoid missing tweets at boundary
    const d = new Date(row[0].completedAt);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  return PROGRAM_START_DATE;
}

// ── Tweet type detection ──────────────────────────────────────────────────────

function getTweetType(tweet: Record<string, unknown>): "post" | "reply" | "quote" | "retweet" {
  if (tweet.isRetweet) return "retweet";
  if (tweet.isQuote) return "quote";
  if (tweet.inReplyToStatusId || tweet.inReplyToUserId) return "reply";
  return "post";
}

// ── Parse Twitter's date format ───────────────────────────────────────────────

function parseTwitterDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr);
  // Twitter format: "Thu Mar 05 09:32:29 +0000 2026"
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // Try manual parse for Twitter format
  const match = str.match(/(\w+)\s+(\w+)\s+(\d+)\s+(\d+:\d+:\d+)\s+\+0000\s+(\d+)/);
  if (match) {
    const parsed = new Date(`${match[2]} ${match[3]} ${match[5]} ${match[4]} UTC`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

// ── Import a dataset into x_activity ─────────────────────────────────────────
//
// FILTERING RULES (MASTER.md Section 15):
//   - Tweets from searchTerms queries already match protocol keywords (Apify filtered them)
//     BUT we still apply isBrandRelated() as a safety net.
//   - Tweets from twitterHandles (full profile timeline) MUST pass isBrandRelated()
//     UNLESS they are direct engagement with an official brand handle.
//   - Apify mixes both sources into one dataset with no source tag, so we apply
//     isBrandRelated() to ALL tweets. Category A tweets (to:<official handle>)
//     are already captured by the dedicated search queries and will pass the filter
//     because they contain an official handle in their text or metadata.
//
// NOTE: Likes are NOT stored. Twitter's API does not expose who liked a tweet.
// The `likes` column stores the like COUNT on the ambassador's own tweet (vanity metric only).

async function importDataset(
  datasetId: string,
  ambassadorId: number,
  sinceDate: string
): Promise<number> {
  const since = new Date(sinceDate);
  
  // Fetch all items from the dataset (paginate if needed)
  let allItems: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 200;
  
  while (true) {
    const res = await apifyFetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}&offset=${offset}&clean=true`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch dataset ${datasetId}: ${res.status}`);
    }
    const items = (await res.json()) as Record<string, unknown>[];
    allItems = allItems.concat(items);
    if (items.length < limit) break;
    offset += limit;
  }

  if (allItems.length === 0) return 0;

  const db = getDb();
  let inserted = 0;

  for (const tweet of allItems) {
    const tweetId = String(tweet.id || tweet.tweetId || "");
    if (!tweetId) continue;

    const postedAt = parseTwitterDate(tweet.createdAt);
    if (!postedAt) continue;

    // Filter: only tweets on or after sinceDate
    if (postedAt < since) continue;

    const tweetType = getTweetType(tweet);
    const text = String(tweet.text || tweet.fullText || "");

    // ── BRAND RELEVANCE FILTER ──────────────────────────────────────────────────
    // Extract quoted/retweeted author handle for Category A check
    const retweetedUser = (tweet.retweetedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
    const quotedUser = (tweet.quotedStatus as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
    const quotedFromHandle = String(retweetedUser?.screen_name || quotedUser?.screen_name || "");

    // Extract reply-to handle
    const inReplyToHandle = String(
      (tweet.inReplyToUser as Record<string, unknown>)?.screen_name ||
      tweet.inReplyToScreenName ||
      ""
    );

    // Category A: direct engagement with a configured official handle — always pass
    const officialHandles = BRAND_OFFICIAL_HANDLES;
    const isCategoryA =
      officialHandles.includes(inReplyToHandle.toLowerCase().replace(/^@/, "")) ||
      officialHandles.includes(quotedFromHandle.toLowerCase().replace(/^@/, ""));

    // Category B/C: must mention protocol keywords
    // X Articles have very short/empty text — allow them through (they are ambassador content)
    const isXArticle = text.length < 30 || text.startsWith("https://");

    if (!isCategoryA && !isBrandRelated(text) && !isXArticle) {
      continue; // Drop — not protocol-related
    }
    // ─────────────────────────────────────────────────────────────────────────

    let quotedFrom: string | null = quotedFromHandle || null;

    const tweetUrl = tweet.url
      ? String(tweet.url)
      : `https://x.com/i/web/status/${tweetId}`;

    // Upsert: insert new, update engagement metrics on existing
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
        bookmarks: Number(tweet.bookmarkCount || 0),
        quotedFrom,
        tweetUrl,
        postedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          likes: sql`VALUES(likes)`,
          retweets: sql`VALUES(retweets)`,
          replies: sql`VALUES(replies)`,
          bookmarks: sql`VALUES(bookmarks)`,
          scrapedAt: sql`NOW()`,
        },
      });
    inserted++;
  }

  return inserted;
}

// ── Start a scrape job ────────────────────────────────────────────────────────

export async function startScrapeJob(
  triggeredBy: "manual" | "scheduled" = "manual",
  webhookBaseUrl: string,
  sinceDateOverride?: string  // If set, all ambassadors are scraped from this date (full-cohort mode)
): Promise<{ jobId: number; total: number }> {
  const db = getDb();

  // Get all ambassadors with Twitter handles
  const ambassadors = await db
    .select({ id: ambassadorApplications.id, twitterHandle: ambassadorApplications.twitterHandle })
    .from(ambassadorApplications)
    .where(isNotNull(ambassadorApplications.twitterHandle));

  const validAmbassadors = ambassadors.filter(
    (a) => a.twitterHandle && a.twitterHandle.trim() !== ""
  );

  const now = Date.now();

  // Create the job record
  const [jobResult] = await db.execute(
    sql`INSERT INTO scrape_jobs (status, triggeredBy, totalAmbassadors, completedRuns, failedRuns, tweetsImported, startedAt, createdAt)
        VALUES ('running', ${triggeredBy}, ${validAmbassadors.length}, 0, 0, 0, ${now}, ${now})`
  ) as unknown as [{ insertId: number }];
  
  const jobId = jobResult.insertId;

  // Build the webhook URL — called by Apify when each run completes
  const webhookUrl = `${webhookBaseUrl}/api/webhooks/apify`;

  // Fire all Apify runs in parallel batches of 10
  const BATCH_SIZE = 10;
  const runPromises: Promise<void>[] = [];

  for (const ambassador of validAmbassadors) {
    const promise = (async () => {
      const handle = ambassador.twitterHandle!;
      const sinceDate = sinceDateOverride ?? await getStartDateForAmbassador(ambassador.id);
      // No search queries needed — twitterHandles covers the full timeline including X Articles
      const searchTerms: string[] = [];
      const cleanHandle = handle.replace(/^@/, "").replace(/^https?:\/\/x\.com\//, "").trim();

      // Create run record in DB
      const [runResult] = await db.execute(
        sql`INSERT INTO scrape_runs (jobId, ambassadorId, twitterHandle, status, createdAt)
            VALUES (${jobId}, ${ambassador.id}, ${handle}, 'pending', ${Date.now()})`
      ) as unknown as [{ insertId: number }];
      const scrapeRunId = runResult.insertId;

      // Build ad-hoc webhook config (base64 encoded)
      const payloadTemplate = `{"runId":"{{resource.id}}","datasetId":"{{resource.defaultDatasetId}}","status":"{{resource.status}}","scrapeRunId":${scrapeRunId},"jobId":${jobId},"ambassadorId":${ambassador.id},"sinceDate":"${sinceDate}"}`;
      const webhookConfig = Buffer.from(
        JSON.stringify([
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
            requestUrl: webhookUrl,
            shouldInterpolateStrings: true,
            payloadTemplate,
          },
        ])
      ).toString("base64");

      try {
        // Fire the Apify run with ad-hoc webhook
        // twitterHandles: scrapes full profile timeline including X Articles
        // (X Articles are NOT indexed in Twitter search, so searchTerms alone misses them)
        // importDataset() applies isBrandRelated() filter to all twitterHandles results
        const startRes = await apifyFetch(
          `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?webhooks=${webhookConfig}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              searchTerms,
              twitterHandles: [cleanHandle],
              maxItems: 200,
              queryType: "Latest",
              since: sinceDate,
              lang: "",
              includeSearchTerms: false,
            }),
          }
        );

        if (!startRes.ok) {
          const err = await startRes.text();
          throw new Error(`Apify start failed: ${startRes.status} ${err}`);
        }

        const startData = (await startRes.json()) as {
          data: { id: string; defaultDatasetId: string };
        };

        // Update run record with Apify run ID
        await db.execute(
          sql`UPDATE scrape_runs SET apifyRunId = ${startData.data.id}, datasetId = ${startData.data.defaultDatasetId}, status = 'running', startedAt = ${Date.now()} WHERE id = ${scrapeRunId}`
        );
      } catch (err) {
        // Mark run as failed immediately
        await db.execute(
          sql`UPDATE scrape_runs SET status = 'failed', errorMessage = ${err instanceof Error ? err.message : String(err)}, completedAt = ${Date.now()} WHERE id = ${scrapeRunId}`
        );
        await db.execute(
          sql`UPDATE scrape_jobs SET failedRuns = failedRuns + 1 WHERE id = ${jobId}`
        );
      }
    })();

    runPromises.push(promise);

    // Process in batches to avoid overwhelming the API
    if (runPromises.length >= BATCH_SIZE) {
      await Promise.allSettled(runPromises.splice(0, BATCH_SIZE));
    }
  }

  // Wait for remaining batch
  if (runPromises.length > 0) {
    await Promise.allSettled(runPromises);
  }

  console.log(`[ApifyPipeline] Job ${jobId} started: ${validAmbassadors.length} runs fired`);
  return { jobId, total: validAmbassadors.length };
}

// ── Handle webhook callback from Apify ───────────────────────────────────────

export async function handleWebhookCallback(payload: {
  runId: string;
  datasetId: string;
  status: string;
  scrapeRunId: number;
  jobId: number;
  ambassadorId: number;
  sinceDate: string;
}): Promise<void> {
  const { runId, datasetId, status, scrapeRunId, jobId, ambassadorId, sinceDate } = payload;
  const db = getDb();
  const now = Date.now();

  console.log(`[ApifyPipeline] Webhook received: runId=${runId}, status=${status}, job=${jobId}, ambassador=${ambassadorId}`);

  if (status !== "SUCCEEDED") {
    // Run failed — mark it and update job counts
    await db.execute(
      sql`UPDATE scrape_runs SET status = 'failed', apifyRunId = ${runId}, completedAt = ${now} WHERE id = ${scrapeRunId}`
    );
    await db.execute(
      sql`UPDATE scrape_jobs SET failedRuns = failedRuns + 1, completedRuns = completedRuns + 1 WHERE id = ${jobId}`
    );
  } else {
    // Import the dataset
    let tweetsImported = 0;
    try {
      tweetsImported = await importDataset(datasetId, ambassadorId, sinceDate);
      
      await db.execute(
        sql`UPDATE scrape_runs SET status = 'imported', apifyRunId = ${runId}, datasetId = ${datasetId}, tweetsImported = ${tweetsImported}, completedAt = ${now} WHERE id = ${scrapeRunId}`
      );
      await db.execute(
        sql`UPDATE scrape_jobs SET completedRuns = completedRuns + 1, tweetsImported = tweetsImported + ${tweetsImported} WHERE id = ${jobId}`
      );
      
      console.log(`[ApifyPipeline] Imported ${tweetsImported} tweets for ambassador ${ambassadorId}`);
    } catch (err) {
      console.error(`[ApifyPipeline] Import failed for run ${scrapeRunId}:`, err);
      await db.execute(
        sql`UPDATE scrape_runs SET status = 'failed', errorMessage = ${err instanceof Error ? err.message : String(err)}, completedAt = ${now} WHERE id = ${scrapeRunId}`
      );
      await db.execute(
        sql`UPDATE scrape_jobs SET failedRuns = failedRuns + 1, completedRuns = completedRuns + 1 WHERE id = ${jobId}`
      );
    }
  }

  // Check if all runs for this job are done
  const [jobRows] = await db.execute(
    sql`SELECT totalAmbassadors, completedRuns, failedRuns FROM scrape_jobs WHERE id = ${jobId}`
  ) as unknown as [Array<{ totalAmbassadors: number; completedRuns: number; failedRuns: number }>];

  if (!jobRows || jobRows.length === 0) return;

  const job = jobRows[0];
  const allDone = job.completedRuns >= job.totalAmbassadors;

  if (allDone) {
    console.log(`[ApifyPipeline] Job ${jobId} complete. Running XP recalculation...`);
    
    try {
      const updated = await recalculateAllXP();
      const finalStatus = job.failedRuns > 0 ? "partial" : "completed";
      
      await db.execute(
        sql`UPDATE scrape_jobs SET status = ${finalStatus}, completedAt = ${now} WHERE id = ${jobId}`
      );
      
      console.log(`[ApifyPipeline] Job ${jobId} finished. XP updated for ${updated} ambassadors. Status: ${finalStatus}`);
    } catch (err) {
      console.error(`[ApifyPipeline] XP recalculation failed for job ${jobId}:`, err);
      await db.execute(
        sql`UPDATE scrape_jobs SET status = 'partial', completedAt = ${now} WHERE id = ${jobId}`
      );
    }
  }
}

// ── Get job status ────────────────────────────────────────────────────────────

export async function getScrapeJobStatus(jobId: number): Promise<{
  id: number;
  status: string;
  triggeredBy: string;
  totalAmbassadors: number;
  completedRuns: number;
  failedRuns: number;
  tweetsImported: number;
  startedAt: number;
  completedAt: number | null;
  progressPercent: number;
  runs: Array<{
    id: number;
    twitterHandle: string | null;
    status: string;
    tweetsImported: number;
    errorMessage: string | null;
  }>;
} | null> {
  const db = getDb();
  
  const [jobRows] = await db.execute(
    sql`SELECT * FROM scrape_jobs WHERE id = ${jobId}`
  ) as unknown as [Array<Record<string, unknown>>];
  
  if (!jobRows || jobRows.length === 0) return null;
  const job = jobRows[0];

  const [runRows] = await db.execute(
    sql`SELECT id, twitterHandle, status, tweetsImported, errorMessage FROM scrape_runs WHERE jobId = ${jobId} ORDER BY id`
  ) as unknown as [Array<Record<string, unknown>>];

  const total = Number(job.totalAmbassadors) || 0;
  const completed = Number(job.completedRuns) || 0;

  return {
    id: Number(job.id),
    status: String(job.status),
    triggeredBy: String(job.triggeredBy),
    totalAmbassadors: total,
    completedRuns: completed,
    failedRuns: Number(job.failedRuns) || 0,
    tweetsImported: Number(job.tweetsImported) || 0,
    startedAt: Number(job.startedAt),
    completedAt: job.completedAt ? Number(job.completedAt) : null,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    runs: (runRows || []).map((r) => ({
      id: Number(r.id),
      twitterHandle: r.twitterHandle ? String(r.twitterHandle) : null,
      status: String(r.status),
      tweetsImported: Number(r.tweetsImported) || 0,
      errorMessage: r.errorMessage ? String(r.errorMessage) : null,
    })),
  };
}

// ── Get last completed job ────────────────────────────────────────────────────

export async function getLastCompletedJob(): Promise<{
  id: number;
  status: string;
  triggeredBy: string;
  totalAmbassadors: number;
  completedRuns: number;
  failedRuns: number;
  tweetsImported: number;
  startedAt: number;
  completedAt: number | null;
} | null> {
  const [rows] = await getDb().execute(
    sql`SELECT id, status, triggeredBy, totalAmbassadors, completedRuns, failedRuns, tweetsImported, startedAt, completedAt
        FROM scrape_jobs 
        WHERE status IN ('completed', 'partial')
          AND triggeredBy != 'official-engagement'
        ORDER BY completedAt DESC LIMIT 1`
  ) as unknown as [Array<Record<string, unknown>>];

  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    status: String(r.status),
    triggeredBy: String(r.triggeredBy),
    totalAmbassadors: Number(r.totalAmbassadors),
    completedRuns: Number(r.completedRuns),
    failedRuns: Number(r.failedRuns),
    tweetsImported: Number(r.tweetsImported),
    startedAt: Number(r.startedAt),
    completedAt: r.completedAt ? Number(r.completedAt) : null,
  };
}

// ── Get current running job (if any) ─────────────────────────────────────────

export async function getCurrentRunningJob(): Promise<{ id: number; progressPercent: number; completedRuns: number; totalAmbassadors: number; startedAt: number } | null> {
  // Only show ambassador scrape jobs (not official-engagement), and only if started within the last 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const [rows] = await getDb().execute(
    sql`SELECT id, totalAmbassadors, completedRuns, startedAt FROM scrape_jobs
        WHERE status = 'running'
          AND triggeredBy != 'official-engagement'
          AND startedAt > ${twoHoursAgo}
        ORDER BY startedAt DESC LIMIT 1`
  ) as unknown as [Array<Record<string, unknown>>];

  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  const total = Number(r.totalAmbassadors) || 0;
  const completed = Number(r.completedRuns) || 0;
  return {
    id: Number(r.id),
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedRuns: completed,
    totalAmbassadors: total,
    startedAt: Number(r.startedAt),
  };
}

// ── Scrape engagement on official brand accounts ────────
/**
 * Scrape replies, quotes, and reposts on official brand account posts
 * by known ambassadors. This fills the Category A gap where an ambassador
 * replies to an official account — no brand keyword in the reply text, so
 * the per-ambassador scrape misses it.
 *
 * Strategy:
 *   1. Fetch all replies to each official handle    (Apify: to:<handle>)
 *   2. Fetch reposts of each official handle         (Apify: retweets of:<handle>)
 *   5. Cross-reference author handles against ambassador list
 *   6. Upsert matching tweets into x_activity under the correct ambassadorId
 *
 * Note: These tweets bypass isBrandRelated() — they are Category A by definition.
 */
export async function scrapeOfficialAccountEngagement(
  webhookBaseUrl: string,
  sinceDate?: string
): Promise<{ jobId: number; runsStarted: number }> {
  const db = getDb();
  const since = sinceDate ?? PROGRAM_START_DATE;

  // Build ambassador handle → id lookup (lowercase for case-insensitive match)
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

  const now = Date.now();
  // Create a special scrape job for official engagement (6 runs)
  const [jobResult] = await db.execute(
    sql`INSERT INTO scrape_jobs (status, triggeredBy, totalAmbassadors, completedRuns, failedRuns, tweetsImported, startedAt, createdAt)
        VALUES ('running', 'official-engagement', 6, 0, 0, 0, ${now}, ${now})`
  ) as unknown as [{ insertId: number }];
  const jobId = jobResult.insertId;

  const webhookUrl = `${webhookBaseUrl}/api/webhooks/apify/official`;

  // The 6 search queries to run
  const officialQueries = [
    { label: "replies-to-official-0", searchTerms: [`to:${BRAND_OFFICIAL_HANDLES[0]}`] },
    { label: "replies-to-official-1", searchTerms: BRAND_OFFICIAL_HANDLES[1] ? [`to:${BRAND_OFFICIAL_HANDLES[1]}`] : [] },
    { label: "retweets-of-official-0", searchTerms: [`retweets of:${BRAND_OFFICIAL_HANDLES[0]}`] },
    { label: "retweets-of-official-1", searchTerms: BRAND_OFFICIAL_HANDLES[1] ? [`retweets of:${BRAND_OFFICIAL_HANDLES[1]}`] : [] },
    // Official posts from configured handles (stored as official reference content)
    { label: "posts-from-official-0", searchTerms: [`from:${BRAND_OFFICIAL_HANDLES[0]}`] },
    { label: "posts-from-official-1", searchTerms: BRAND_OFFICIAL_HANDLES[1] ? [`from:${BRAND_OFFICIAL_HANDLES[1]}`] : [] },
  ];

  // Serialize handleToId map for webhook payload
  const handleMapJson = JSON.stringify(Object.fromEntries(handleToId));

  let runsStarted = 0;
  for (const q of officialQueries) {
    try {
      const [runResult] = await db.execute(
        sql`INSERT INTO scrape_runs (jobId, ambassadorId, twitterHandle, status, createdAt)
            VALUES (${jobId}, NULL, ${q.label}, 'pending', ${Date.now()})`
      ) as unknown as [{ insertId: number }];
      const scrapeRunId = runResult.insertId;

      const escapedHandleMap = handleMapJson.replace(/"/g, '\\"');
      const officialPayloadTemplate = `{"runId":"{{resource.id}}","datasetId":"{{resource.defaultDatasetId}}","status":"{{resource.status}}","scrapeRunId":${scrapeRunId},"jobId":${jobId},"sinceDate":"${since}","handleMap":"${escapedHandleMap}"}`;
      const webhookConfig = Buffer.from(
        JSON.stringify([
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
            requestUrl: webhookUrl,
            shouldInterpolateStrings: true,
            payloadTemplate: officialPayloadTemplate,
          },
        ])
      ).toString("base64");

      const startRes = await apifyFetch(
        `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?webhooks=${webhookConfig}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchTerms: q.searchTerms,
            maxItems: 500,
            queryType: "Latest",
            since,
            lang: "",
            includeSearchTerms: false,
          }),
        }
      );

      if (!startRes.ok) {
        const err = await startRes.text();
        throw new Error(`Apify start failed for ${q.label}: ${startRes.status} ${err}`);
      }
      const startData = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };
      await db.execute(
        sql`UPDATE scrape_runs SET apifyRunId = ${startData.data.id}, datasetId = ${startData.data.defaultDatasetId}, status = 'running', startedAt = ${Date.now()} WHERE id = ${scrapeRunId}`
      );
      runsStarted++;
    } catch (err) {
      console.error(`[ApifyPipeline] Official engagement run failed for ${q.label}:`, err);
      await db.execute(
        sql`UPDATE scrape_jobs SET failedRuns = failedRuns + 1, completedRuns = completedRuns + 1 WHERE id = ${jobId}`
      );
    }
  }

  console.log(`[ApifyPipeline] Official engagement job ${jobId} started: ${runsStarted}/6 runs fired`);
  return { jobId, runsStarted };
}

/**
 * Handle webhook callback for official engagement scrape runs.
 * Resolves tweet authors against the ambassador handle map and upserts into x_activity.
 * These tweets are Category A — they bypass isBrandRelated() by definition.
 */
export async function handleOfficialEngagementWebhook(payload: {
  runId: string;
  datasetId: string;
  status: string;
  scrapeRunId: number;
  jobId: number;
  sinceDate: string;
  handleMap: string; // JSON string of { lowercaseHandle: ambassadorId }
}): Promise<void> {
  const { datasetId, status, scrapeRunId, jobId, sinceDate, handleMap } = payload;
  const db = getDb();
  const now = Date.now();

  if (status !== "SUCCEEDED") {
    await db.execute(
      sql`UPDATE scrape_runs SET status = 'failed', completedAt = ${now} WHERE id = ${scrapeRunId}`
    );
    await db.execute(
      sql`UPDATE scrape_jobs SET failedRuns = failedRuns + 1, completedRuns = completedRuns + 1 WHERE id = ${jobId}`
    );
    return;
  }

  // Parse handle → ambassadorId map
  let handleToId: Record<string, number> = {};
  try { handleToId = JSON.parse(handleMap); } catch { /* ignore */ }

  const since = new Date(sinceDate);
  let imported = 0;

  // Fetch dataset items (paginated)
  let allItems: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const res = await apifyFetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}&offset=${offset}&clean=true`
    );
    if (!res.ok) break;
    const items = (await res.json()) as Record<string, unknown>[];
    allItems = allItems.concat(items);
    if (items.length < limit) break;
    offset += limit;
  }

  for (const tweet of allItems) {
    const tweetId = String(tweet.id || tweet.tweetId || "");
    if (!tweetId) continue;

    const postedAt = parseTwitterDate(tweet.createdAt);
    if (!postedAt || postedAt < since) continue;

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
    const ambassadorId = handleToId[authorHandle];
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
        bookmarks: Number(tweet.bookmarkCount || 0),
        quotedFrom,
        tweetUrl,
        postedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          likes: sql`VALUES(likes)`,
          retweets: sql`VALUES(retweets)`,
          replies: sql`VALUES(replies)`,
          bookmarks: sql`VALUES(bookmarks)`,
          scrapedAt: sql`NOW()`,
        },
      });
    imported++;
  }

  await db.execute(
    sql`UPDATE scrape_runs SET status = 'imported', tweetsImported = ${imported}, completedAt = ${now} WHERE id = ${scrapeRunId}`
  );
  await db.execute(
    sql`UPDATE scrape_jobs SET completedRuns = completedRuns + 1, tweetsImported = tweetsImported + ${imported} WHERE id = ${jobId}`
  );

  console.log(`[ApifyPipeline] Official engagement run ${scrapeRunId} done: ${imported} ambassador engagements imported`);

  // Check if all runs are done → trigger XP recalculation
  const [jobRows] = await db.execute(
    sql`SELECT totalAmbassadors, completedRuns, failedRuns FROM scrape_jobs WHERE id = ${jobId}`
  ) as unknown as [Array<{ totalAmbassadors: number; completedRuns: number; failedRuns: number }>];
  if (!jobRows || jobRows.length === 0) return;
  const job = jobRows[0];
  if (job.completedRuns >= job.totalAmbassadors) {
    const finalStatus = job.failedRuns > 0 ? "partial" : "completed";
    await db.execute(
      sql`UPDATE scrape_jobs SET status = ${finalStatus}, completedAt = ${now} WHERE id = ${jobId}`
    );
    recalculateAllXP().catch((err) =>
      console.error(`[ApifyPipeline] XP recalculate after official engagement failed:`, err)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE 3 — Conversation Thread Scrape (SCRAPING_SPEC_VERSION: 6.0)
//
// Purpose: Fetch all replies in threads started by ambassadors on protocol-related
// posts. This captures thread continuations (e.g. reply #2, #3, #4 in a thread)
// that don't repeat the protocol keyword in their own text.
//
// How it works:
//   1. Collect tweetIds of all ambassador posts in x_activity (tweetType='post')
//   2. Pass those tweetIds as conversationIds to apidojo/tweet-scraper
//   3. Match reply authors against the ambassador handle map
//   4. Store matched replies with pipeline='conversation'
//
// These tweets bypass isBrandRelated() — they qualify by being in a protocol thread.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start Pipeline 3: scrape all conversation threads for ambassador protocol posts.
 */
export async function startConversationThreadScrape(webhookBaseUrl: string): Promise<{
  runId: string;
  conversationCount: number;
}> {
  const db = getDb();

  // Collect all tweetIds from ambassador posts (Pipeline 1 output)
  const [postRows] = await db.execute(
    sql`SELECT DISTINCT tweetId FROM x_activity WHERE tweetType = 'post' AND tweetId IS NOT NULL`
  ) as unknown as [Array<{ tweetId: string }>];

  if (!postRows || postRows.length === 0) {
    throw new Error("No ambassador posts found to scrape conversations for");
  }

  const conversationIds = postRows.map(r => r.tweetId).filter(Boolean);
  if (conversationIds.length === 0) throw new Error("No valid tweet IDs found");

  // Build ambassador handle map for matching
  const [ambassadors] = await db.execute(
    sql`SELECT id, twitterHandle FROM ambassador_applications WHERE status != 'rejected' AND twitterHandle IS NOT NULL`
  ) as unknown as [Array<{ id: number; twitterHandle: string }>];
  const handleMap: Record<string, number> = {};
  for (const a of ambassadors) {
    const h = a.twitterHandle.toLowerCase().replace(/^@/, "");
    if (h) handleMap[h] = a.id;
  }

  // Create a scrape_run record
  const [runResult] = await db.execute(
    sql`INSERT INTO scrape_runs (jobId, apifyRunId, datasetId, status, startedAt)
        VALUES (0, 'pending', '', 'pending', ${Date.now()})`
  ) as unknown as [{ insertId: number }];
  const scrapeRunId = runResult.insertId;

  const webhookUrl = `${webhookBaseUrl}/api/webhooks/apify/conversation`;
  const webhookConfig = Buffer.from(
    JSON.stringify({
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
      requestUrl: webhookUrl,
      payloadTemplate: JSON.stringify({
        runId: "{{resource.id}}",
        datasetId: "{{resource.defaultDatasetId}}",
        status: "{{resource.status}}",
        scrapeRunId,
        handleMap: JSON.stringify(handleMap),
      }),
    })
  ).toString("base64");

  const startRes = await apifyFetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?webhooks=${webhookConfig}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationIds,
        maxItems: conversationIds.length * 50,
        includeSearchTerms: false,
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Apify conversation scrape start failed: ${startRes.status} ${err}`);
  }

  const startData = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };
  await db.execute(
    sql`UPDATE scrape_runs SET apifyRunId = ${startData.data.id}, datasetId = ${startData.data.defaultDatasetId}, status = 'running', startedAt = ${Date.now()} WHERE id = ${scrapeRunId}`
  );

  console.log(`[Pipeline3] Conversation scrape started: ${conversationIds.length} threads, runId=${startData.data.id}`);
  return { runId: startData.data.id, conversationCount: conversationIds.length };
}

/**
 * Handle webhook callback for Pipeline 3 conversation thread scrape.
 */
export async function handleConversationWebhook(payload: {
  runId: string;
  datasetId: string;
  status: string;
  scrapeRunId: number;
  handleMap: string;
}): Promise<void> {
  const { datasetId, status, scrapeRunId, handleMap } = payload;
  const db = getDb();
  const now = Date.now();

  if (status !== "SUCCEEDED") {
    await db.execute(
      sql`UPDATE scrape_runs SET status = 'failed', completedAt = ${now} WHERE id = ${scrapeRunId}`
    );
    return;
  }

  let handleToId: Record<string, number> = {};
  try { handleToId = JSON.parse(handleMap); } catch { /* ignore */ }

  let allItems: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const res = await apifyFetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}&offset=${offset}&clean=true`
    );
    if (!res.ok) break;
    const items = (await res.json()) as Record<string, unknown>[];
    allItems = allItems.concat(items);
    if (items.length < limit) break;
    offset += limit;
  }

  let imported = 0;
  for (const tweet of allItems) {
    const tweetId = String(tweet.id || tweet.tweetId || "");
    if (!tweetId) continue;

    const authorHandle = String(
      (tweet.author as Record<string, unknown>)?.userName ||
      (tweet.author as Record<string, unknown>)?.username ||
      (tweet.user as Record<string, unknown>)?.screen_name ||
      tweet.authorHandle ||
      tweet.username ||
      ""
    ).toLowerCase().replace(/^@/, "");
    if (!authorHandle) continue;

    const ambassadorId = handleToId[authorHandle];
    if (!ambassadorId) continue;

    const tweetType = getTweetType(tweet);
    // Only store replies and quotes from threads (root posts already stored by Pipeline 1)
    if (tweetType !== "reply" && tweetType !== "quote") continue;

    const text = String(tweet.text || tweet.fullText || "");
    const postedAt = parseTwitterDate(tweet.createdAt);
    if (!postedAt) continue;

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
        bookmarks: Number(tweet.bookmarkCount || 0),
        quotedFrom: null,
        tweetUrl,
        postedAt,
        pipeline: "conversation",
      })
      .onDuplicateKeyUpdate({
        set: {
          likes: sql`VALUES(likes)`,
          retweets: sql`VALUES(retweets)`,
          replies: sql`VALUES(replies)`,
          bookmarks: sql`VALUES(bookmarks)`,
          scrapedAt: sql`NOW()`,
        },
      });
    imported++;
  }

  await db.execute(
    sql`UPDATE scrape_runs SET status = 'imported', tweetsImported = ${imported}, completedAt = ${now} WHERE id = ${scrapeRunId}`
  );
  console.log(`[Pipeline3] Conversation webhook done: ${imported} thread replies imported`);

  recalculateAllXP().catch(err =>
    console.error("[Pipeline3] XP recalculate after conversation scrape failed:", err)
  );
}
