/**
 * RE-IMPORT STAGING SCRIPT
 * Uses existing Apify dataset IDs from scrape_staging_log.json
 * Re-imports with fixed date parsing into x_activity_staging
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

const APIFY_TOKEN = process.env.APIFY_API_KEY;
const STAGING_TABLE = 'x_activity_staging';
const SINCE_TIMESTAMP = new Date('2026-03-06T00:00:00Z').getTime();

function classifyType(tweet) {
  if (tweet.isRetweet || tweet.retweetedTweet) return 'retweet';
  if (tweet.isQuote || tweet.quotedTweet) return 'quote';
  if (tweet.isReply || tweet.inReplyToId) return 'reply';
  return 'post';
}

async function fetchDataset(datasetId) {
  const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=1000&clean=true`);
  if (!resp.ok) throw new Error(`Failed to fetch dataset ${datasetId}: ${resp.status}`);
  return resp.json();
}

async function importToStaging(conn, ambassadorId, tweets) {
  let inserted = 0;
  let skipped = 0;
  let beforeDate = 0;

  for (const tweet of tweets) {
    const tweetId = tweet.id || tweet.tweetId || tweet.tweet_id;
    if (!tweetId) { skipped++; continue; }

    const rawDate = tweet.createdAt || tweet.created_at || tweet.date;
    if (!rawDate) { skipped++; continue; }
    const postedAt = new Date(rawDate);
    if (isNaN(postedAt.getTime())) { skipped++; continue; }
    if (postedAt.getTime() < SINCE_TIMESTAMP) { beforeDate++; continue; }

    const tweetType = classifyType(tweet);
    const content = tweet.fullText || tweet.text || tweet.full_text || '';
    const likes = tweet.likeCount || tweet.favorite_count || tweet.likes || 0;
    const retweets = tweet.retweetCount || tweet.retweet_count || tweet.retweets || 0;
    const replies = tweet.replyCount || tweet.reply_count || tweet.replies || 0;
    const quotes = tweet.quoteCount || tweet.quote_count || tweet.quotes || 0;
    const bookmarks = tweet.bookmarkCount || tweet.bookmarks || 0;
    const tweetUrl = tweet.url || tweet.twitterUrl || `https://x.com/i/web/status/${tweetId}`;
    const engagementScore = replies * 3 + quotes * 2 + retweets * 1 + likes * 0.5;

    try {
      const [result] = await conn.execute(
        `INSERT IGNORE INTO ${STAGING_TABLE} 
         (applicationId, tweetId, tweetType, content, likes, retweets, replies, quotes, bookmarks, postedAt, tweetUrl, engagementScore, isBrandRelated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [ambassadorId, tweetId, tweetType, content.slice(0, 2000), likes, retweets, replies, quotes, bookmarks, postedAt, tweetUrl, engagementScore]
      );
      if (result.affectedRows > 0) inserted++;
      else skipped++;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') console.error(`  Insert error tweet ${tweetId}:`, err.message);
      skipped++;
    }
  }

  return { inserted, skipped, beforeDate };
}

async function main() {
  const log = JSON.parse(fs.readFileSync(process.env.STAGING_LOG_PATH ?? './scrape_staging_log.json', 'utf8'));
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  console.log(`Re-importing ${log.length} ambassador datasets...\n`);

  let totalInserted = 0;
  let totalBeforeDate = 0;

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry.status !== 'ok' || !entry.datasetId) {
      console.log(`[${i+1}/${log.length}] @${entry.handle} — skipped (no dataset)`);
      continue;
    }

    process.stdout.write(`[${i+1}/${log.length}] @${entry.handle} (dataset: ${entry.datasetId})... `);
    
    try {
      const tweets = await fetchDataset(entry.datasetId);
      const { inserted, skipped, beforeDate } = await importToStaging(conn, entry.id, tweets);
      totalInserted += inserted;
      totalBeforeDate += beforeDate;
      console.log(`fetched ${tweets.length}, inserted ${inserted}, before-date ${beforeDate}, skipped ${skipped}`);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
    }
  }

  await conn.end();

  const [[cnt]] = await (async () => {
    const c = await mysql.createConnection(process.env.DATABASE_URL);
    const r = await c.execute('SELECT COUNT(*) as cnt FROM x_activity_staging');
    await c.end();
    return r;
  })();

  console.log(`\n=== DONE ===`);
  console.log(`Total inserted into staging: ${totalInserted}`);
  console.log(`Filtered out (before Mar 6): ${totalBeforeDate}`);
  console.log(`Staging table total: ${cnt.cnt}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
