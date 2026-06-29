/**
 * STAGING SCRAPE SCRIPT
 * 
 * Triggers fresh Apify scrape runs for all ambassadors from Mar 6, 2026.
 * Imports results into x_activity_staging table ONLY — live data untouched.
 * 
 * Queries per ambassador:
 *   1. from:@handle (<BRAND_KEYWORD> OR #<BRAND_TAG> OR $<BRAND_TICKER> OR "<brand name>" OR <brand-domain>)
 *   2. from:@handle to:<OFFICIAL_HANDLE>
 *   3. from:@handle to:<SECONDARY_OFFICIAL_HANDLE>
 * 
 * Run: node scrape_staging.mjs
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

const APIFY_TOKEN = process.env.APIFY_API_KEY;
const ACTOR_ID = '61RPP7dywgiy0JPD0'; // apidojo/tweet-scraper
const SINCE_DATE = '2026-03-06';
const SINCE_TIMESTAMP = new Date('2026-03-06T00:00:00Z').getTime();
const STAGING_TABLE = 'x_activity_staging';

// Clean handle — strip @ and URL prefix
function cleanHandle(raw) {
  if (!raw) return null;
  let h = raw.trim();
  if (h.startsWith('https://x.com/')) h = h.replace('https://x.com/', '');
  if (h.startsWith('https://twitter.com/')) h = h.replace('https://twitter.com/', '');
  if (h.startsWith('@')) h = h.slice(1);
  return h.trim() || null;
}

// Build search queries for one ambassador
function buildQueries(handle) {
  return [
    `from:${handle} (${process.env.BRAND_SEARCH_QUERY ?? "yourprotocol OR #yourtag"})`,
    `from:${handle} to:${process.env.BRAND_OFFICIAL_HANDLE ?? "your_official_handle"}`,
    `from:${handle} to:${process.env.BRAND_SECONDARY_HANDLE ?? ""}`,
  ];
}

// Trigger one Apify run
async function triggerRun(handle, ambassadorId) {
  const queries = buildQueries(handle);
  const input = {
    searchTerms: queries,
    maxItems: 200,
    since: SINCE_DATE,
    twitterContent: 'tweets',
    includeSearchTerms: false,
    onlyVerifiedUsers: false,
    minimumRetweets: 0,
    minimumFavorites: 0,
    minimumReplies: 0,
  };

  const resp = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to trigger run for ${handle}: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.data.id; // runId
}

// Wait for a run to complete (poll every 10s, timeout 5 min)
async function waitForRun(runId, handle) {
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 10000; // 10 seconds
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const data = await resp.json();
    const status = data.data?.status;

    if (status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Run ${runId} for ${handle} ended with status: ${status}`);
    }

    process.stdout.write(`  [${handle}] run ${runId} status: ${status} — waiting...\r`);
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`Run ${runId} for ${handle} timed out after 5 minutes`);
}

// Fetch dataset items
async function fetchDataset(datasetId) {
  const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=1000&clean=true`);
  if (!resp.ok) throw new Error(`Failed to fetch dataset ${datasetId}: ${resp.status}`);
  return resp.json();
}

// Classify tweet type
function classifyType(tweet) {
  if (tweet.isRetweet || tweet.retweetedTweet) return 'retweet';
  if (tweet.isQuote || tweet.quotedTweet) return 'quote';
  if (tweet.inReplyToTweetId || tweet.replyToTweetId || tweet.isReply) return 'reply';
  return 'post';
}

// Import tweets into staging
async function importToStaging(conn, ambassadorId, tweets) {
  let inserted = 0;
  let skipped = 0;

  for (const tweet of tweets) {
    const tweetId = tweet.id || tweet.tweetId || tweet.tweet_id;
    if (!tweetId) { skipped++; continue; }

    // Parse Twitter date format: "Thu Mar 05 09:32:29 +0000 2026"
    const rawDate = tweet.createdAt || tweet.created_at || tweet.date;
    if (!rawDate) { skipped++; continue; }
    const postedAt = new Date(rawDate);
    if (isNaN(postedAt.getTime())) { skipped++; continue; }
    // Filter out tweets before SINCE_DATE
    if (postedAt.getTime() < SINCE_TIMESTAMP) { skipped++; continue; }

    const tweetType = classifyType(tweet);
    const content = tweet.fullText || tweet.text || tweet.full_text || '';
    const likes = tweet.likeCount || tweet.favorite_count || tweet.likes || 0;
    const retweets = tweet.retweetCount || tweet.retweet_count || tweet.retweets || 0;
    const replies = tweet.replyCount || tweet.reply_count || tweet.replies || 0;
    const quotes = tweet.quoteCount || tweet.quote_count || tweet.quotes || 0;
    const bookmarks = tweet.bookmarkCount || tweet.bookmarks || 0;
    const tweetUrl = tweet.url || tweet.tweetUrl || `https://x.com/i/web/status/${tweetId}`;

    // Engagement score: reply=3, quote=2, retweet=1, like=0.5
    const engagementScore = replies * 3 + quotes * 2 + retweets * 1 + likes * 0.5;

    try {
      await conn.execute(
        `INSERT IGNORE INTO ${STAGING_TABLE} 
         (applicationId, tweetId, tweetType, content, likes, retweets, replies, quotes, bookmarks, postedAt, tweetUrl, engagementScore, isBrandRelated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [ambassadorId, tweetId, tweetType, content.slice(0, 2000), likes, retweets, replies, quotes, bookmarks, new Date(postedAt), tweetUrl, engagementScore]
      );
      inserted++;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') {
        console.error(`  Insert error for tweet ${tweetId}:`, err.message);
      }
      skipped++;
    }
  }

  return { inserted, skipped };
}

// Main
async function main() {
  console.log('=== STAGING SCRAPE SCRIPT ===');
  console.log(`Since: ${SINCE_DATE}`);
  console.log(`Token: ${APIFY_TOKEN ? APIFY_TOKEN.slice(0, 20) + '...' : 'MISSING!'}`);
  console.log('');

  if (!APIFY_TOKEN) {
    console.error('ERROR: APIFY_API_KEY not set');
    process.exit(1);
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get all ambassadors
  const [ambassadors] = await conn.execute(
    'SELECT id, twitterHandle FROM ambassador_applications WHERE twitterHandle IS NOT NULL AND twitterHandle != "" ORDER BY id'
  );

  console.log(`Found ${ambassadors.length} ambassadors to scrape\n`);

  const results = [];
  const logFile = process.env.STAGING_LOG_PATH ?? './scrape_staging_log.json';

  for (let i = 0; i < ambassadors.length; i++) {
    const amb = ambassadors[i];
    const handle = cleanHandle(amb.twitterHandle);

    if (!handle) {
      console.log(`[${i+1}/${ambassadors.length}] SKIP id=${amb.id} — invalid handle: "${amb.twitterHandle}"`);
      results.push({ id: amb.id, handle: amb.twitterHandle, status: 'skipped', reason: 'invalid handle' });
      continue;
    }

    console.log(`\n[${i+1}/${ambassadors.length}] @${handle} (id=${amb.id})`);

    try {
      // Trigger run
      process.stdout.write(`  Triggering Apify run...`);
      const runId = await triggerRun(handle, amb.id);
      console.log(` runId: ${runId}`);

      // Wait for completion
      const datasetId = await waitForRun(runId, handle);
      console.log(`  Completed. datasetId: ${datasetId}`);

      // Fetch dataset
      const tweets = await fetchDataset(datasetId);
      console.log(`  Fetched ${tweets.length} tweets`);

      // Import to staging
      const { inserted, skipped } = await importToStaging(conn, amb.id, tweets);
      console.log(`  Imported: ${inserted} new, ${skipped} skipped/duplicate`);

      results.push({ id: amb.id, handle, status: 'ok', runId, datasetId, tweetsFound: tweets.length, inserted, skipped });

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ id: amb.id, handle, status: 'error', error: err.message });
    }

    // Save progress after each ambassador
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
  }

  await conn.end();

  // Summary
  console.log('\n=== SUMMARY ===');
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status === 'error');
  const skipped = results.filter(r => r.status === 'skipped');
  const totalInserted = ok.reduce((s, r) => s + (r.inserted || 0), 0);

  console.log(`Completed: ${ok.length}/${ambassadors.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Total tweets imported to staging: ${totalInserted}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  @${e.handle}: ${e.error}`));
  }

  console.log(`\nFull log saved to: ${logFile}`);
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
