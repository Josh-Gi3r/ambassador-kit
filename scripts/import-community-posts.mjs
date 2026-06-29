/**
 * Import community_posts.csv into x_activity table.
 * Run with: node scripts/import-community-posts.mjs
 */
import mysql from "mysql2/promise";
import fs from "fs";

const CSV_PATH = process.env.COMMUNITY_CSV_PATH ?? "./community_posts.csv";

/**
 * Minimal CSV parser that handles quoted fields with embedded commas/newlines.
 */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  function parseField() {
    if (i < n && text[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let val = "";
      while (i < n) {
        if (text[i] === '"') {
          if (i + 1 < n && text[i + 1] === '"') {
            val += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          val += text[i++];
        }
      }
      return val;
    } else {
      // Unquoted field
      let val = "";
      while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
        val += text[i++];
      }
      return val;
    }
  }

  function parseRow() {
    const fields = [];
    while (i < n && text[i] !== "\n" && text[i] !== "\r") {
      fields.push(parseField());
      if (i < n && text[i] === ",") i++;
    }
    // skip \r\n or \n
    if (i < n && text[i] === "\r") i++;
    if (i < n && text[i] === "\n") i++;
    return fields;
  }

  // Parse header
  const header = parseRow();
  // Parse data rows
  while (i < n) {
    if (text[i] === "\r" || text[i] === "\n") { i++; continue; }
    const fields = parseRow();
    if (fields.length === 0 || (fields.length === 1 && fields[0] === "")) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = fields[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Load ambassador handles -> applicationId map
  const [apps] = await conn.execute(
    "SELECT id, twitterHandle FROM ambassador_applications WHERE twitterHandle IS NOT NULL AND twitterHandle != ''"
  );
  const handleMap = {};
  for (const app of apps) {
    let h = (app.twitterHandle || "").trim();
    if (h.includes("x.com/") || h.includes("twitter.com/")) {
      h = h.split("/").filter(Boolean).pop() || h;
    }
    h = h.replace(/^@+/, "").toLowerCase();
    if (h) handleMap[h] = app.id;
  }
  console.log(`Loaded ${Object.keys(handleMap).length} ambassador handles`);

  // Load existing tweet IDs
  const [existing] = await conn.execute("SELECT tweetId FROM x_activity WHERE tweetId IS NOT NULL");
  const existingIds = new Set(existing.map((r) => r.tweetId));
  console.log(`DB already has ${existingIds.size} tweets`);

  // Parse CSV
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(raw);
  console.log(`CSV has ${rows.length} rows`);

  let inserted = 0, skipped = 0, noMatch = 0;
  for (const row of rows) {
    const tweetId = String(row.id || "").trim();
    if (!tweetId) { skipped++; continue; }
    if (existingIds.has(tweetId)) {
      console.log(`  Skipping existing: ${tweetId}`);
      skipped++;
      continue;
    }

    const handle = (row.authorHandle || "").replace(/^@+/, "").toLowerCase();
    const appId = handleMap[handle];
    if (!appId) {
      console.log(`  No match for handle: ${row.authorHandle}`);
      noMatch++;
      continue;
    }

    const text = row.excerpt || "";
    const postedAt = row.postedAt ? new Date(row.postedAt) : new Date();
    const tweetUrl = row.tweetUrl || `https://x.com/i/web/status/${tweetId}`;

    await conn.execute(
      `INSERT INTO x_activity (applicationId, tweetId, tweetType, text, likes, retweets, replies, bookmarks, tweetUrl, postedAt, scrapedAt)
       VALUES (?, ?, 'post', ?, 0, 0, 0, 0, ?, ?, NOW())`,
      [appId, tweetId, text, tweetUrl, postedAt]
    );
    inserted++;
    existingIds.add(tweetId);
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Inserted (new):   ${inserted}`);
  console.log(`Skipped (exists): ${skipped}`);
  console.log(`No match:         ${noMatch}`);

  const [total] = await conn.execute("SELECT COUNT(*) as cnt FROM x_activity");
  console.log(`\nTotal tweets in DB now: ${total[0].cnt}`);

  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
