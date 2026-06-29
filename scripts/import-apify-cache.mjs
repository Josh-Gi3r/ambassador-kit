/**
 * Import tweets from Apify cached MCP results into x_activity.
 * Rules:
 *   - Only tweets posted 2026-03-04 00:00:00 UTC to 2026-03-17 07:00:00 UTC
 *   - Must be brand-related (keyword match) OR be a reply/quote type
 *   - Deduplicates by tweetId (ON DUPLICATE KEY UPDATE engagement metrics)
 *   - Matches tweet author to ambassador application by twitterHandle
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const WINDOW_START = new Date('2026-03-04T00:00:00Z');
const WINDOW_END   = new Date('2026-03-17T07:00:00Z');

const BRAND_KEYWORDS = [
  // Replace these with your protocol's brand keywords:
  // e.g. 'myprotocol', '@myprotocol', '#myprotocol', 'my protocol',
];

function isBrandRelated(text) {
  const lower = (text || '').toLowerCase();
  return BRAND_KEYWORDS.some(kw => lower.includes(kw));
}

function getTweetType(item) {
  const type = (item.type || '').toLowerCase();
  if (type === 'retweet' || item.retweetedStatus) return 'retweet';
  if (type === 'quote' || item.quotedStatus || item.isQuoteStatus) return 'quote';
  if (type === 'reply' || item.inReplyToStatusId || item.inReplyToStatusIdStr) return 'reply';
  return 'post';
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Load all ambassador handles -> applicationId map
  const [apps] = await conn.execute(
    'SELECT id, twitterHandle FROM ambassador_applications WHERE twitterHandle IS NOT NULL AND twitterHandle != \'\''
  );
  const handleMap = {};
  for (const app of apps) {
    let h = (app.twitterHandle || '').trim();
    // Handle full URLs like https://x.com/dextroalien
    if (h.includes('x.com/') || h.includes('twitter.com/')) {
      h = h.split('/').filter(Boolean).pop() || h;
    }
    // Strip all leading @ signs and lowercase
    h = h.replace(/^@+/, '').toLowerCase();
    if (h) handleMap[h] = app.id;
  }
  console.log('Handle map:', JSON.stringify(handleMap, null, 2).slice(0, 500));
  console.log(`Loaded ${Object.keys(handleMap).length} ambassador handles`);

  // Load existing tweet IDs from DB
  const [existing] = await conn.execute('SELECT tweetId FROM x_activity WHERE tweetId IS NOT NULL');
  const existingIds = new Set(existing.map(r => r.tweetId));
  console.log(`DB already has ${existingIds.size} tweets`);

  // Read all cached Apify dataset results
  const resultsDir = process.env.MCP_RESULTS_DIR ?? './.mcp/tool-results';
  const files = fs.readdirSync(resultsDir).filter(f => f.includes('apify_get-dataset-items'));
  console.log(`Found ${files.length} cached dataset files`);

  // Collect all tweets from cache
  const allTweets = new Map(); // tweetId -> tweet data
  for (const fname of files) {
    try {
      const raw = fs.readFileSync(path.join(resultsDir, fname), 'utf8');
      const start = raw.indexOf('{"items"') >= 0 ? raw.indexOf('{"items"') : raw.indexOf('{');
      const end = raw.lastIndexOf('}') + 1;
      if (start < 0 || end <= start) continue;
      const data = JSON.parse(raw.slice(start, end));
      for (const item of (data.items || [])) {
        if (item.type !== 'tweet') continue;
        const tid = String(item.id || '');
        if (!tid || allTweets.has(tid)) continue;
        allTweets.set(tid, item);
      }
    } catch {}
  }
  console.log(`Total unique tweets in Apify cache: ${allTweets.size}`);

  let inserted = 0, updated = 0, skippedDate = 0, skippedNoMatch = 0, skippedNotBrand = 0;

  for (const [tid, item] of allTweets) {
    const author = (item.author || {});
    const userName = (author.userName || '').toLowerCase();
    const text = String(item.text || '');
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    const tweetType = getTweetType(item);

    // Date window filter
    if (!createdAt || createdAt < WINDOW_START || createdAt > WINDOW_END) {
      skippedDate++;
      continue;
    }

    // Brand relevance: must mention brand keywords OR be a reply/quote (could be responding to brand)
    if (!isBrandRelated(text) && tweetType === 'post') {
      skippedNotBrand++;
      continue;
    }

    // Match to application
    const appId = handleMap[userName];
    if (!appId) {
      skippedNoMatch++;
      continue;
    }

    const likes     = Number(item.likeCount || item.favoriteCount || 0);
    const retweets  = Number(item.retweetCount || 0);
    const replies   = Number(item.replyCount || 0);
    const bookmarks = Number(item.bookmarkCount || 0);
    const url       = item.url || `https://x.com/i/web/status/${tid}`;

    if (existingIds.has(tid)) {
      // Update engagement metrics only
      await conn.execute(
        `UPDATE x_activity SET likes=?, retweets=?, replies=?, bookmarks=?, scrapedAt=NOW()
         WHERE tweetId=?`,
        [likes, retweets, replies, bookmarks, tid]
      );
      updated++;
    } else {
      // Insert new
      await conn.execute(
        `INSERT INTO x_activity (applicationId, tweetId, tweetType, text, likes, retweets, replies, bookmarks, tweetUrl, postedAt, scrapedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [appId, tid, tweetType, text, likes, retweets, replies, bookmarks, url, createdAt]
      );
      inserted++;
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Inserted (new):          ${inserted}`);
  console.log(`Updated (engagement):    ${updated}`);
  console.log(`Skipped (outside window): ${skippedDate}`);
  console.log(`Skipped (not brand-related): ${skippedNotBrand}`);
  console.log(`Skipped (no app match):  ${skippedNoMatch}`);

  const [total] = await conn.execute('SELECT COUNT(*) as cnt FROM x_activity');
  console.log(`\nTotal tweets in DB now:  ${total[0].cnt}`);

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
