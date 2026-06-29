/**
 * import-evangelists.mjs
 * Seeds Evangelist applicants from the CSV into ambassador_applications
 * with isEvangelist=1 so they bypass the knowledge test on /apply.
 *
 * Rules applied:
 * - Deduplicates by email (keeps earliest submission)
 * - Normalises all emails to lowercase
 * - Skips rows already in the DB (upsert by email)
 */

import { createReadStream } from "fs";
import { createInterface } from "readline";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "fs";

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env may not exist in production — rely on real env vars
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// ── Parse CSV ────────────────────────────────────────────────────────────────
const CSV_PATH = process.env.CSV_PATH ?? "./applicants.csv"; // set CSV_PATH in .env or pass as env var

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const rl = createInterface({ input: createReadStream(filePath) });
    let headers = null;
    rl.on("line", (line) => {
      // Simple CSV parse (handles quoted fields)
      const fields = [];
      let inQuote = false;
      let cur = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue; }
        cur += ch;
      }
      fields.push(cur);
      if (!headers) { headers = fields; return; }
      const row = {};
      headers.forEach((h, i) => { row[h] = (fields[i] ?? "").trim(); });
      rows.push(row);
    });
    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
const rows = await parseCSV(CSV_PATH);

// Deduplicate by email — keep earliest createdAt
const seen = new Map();
for (const row of rows) {
  let email = row.email.toLowerCase().trim();
  // Fix known typo
  
  if (!email) continue;

  const existing = seen.get(email);
  if (!existing) {
    seen.set(email, { ...row, email });
  } else {
    // Keep the one with the earlier createdAt
    const existingTime = new Date(existing.createdAt).getTime();
    const newTime = new Date(row.createdAt).getTime();
    if (newTime < existingTime) {
      seen.set(email, { ...row, email });
    }
  }
}

const deduped = Array.from(seen.values());
console.log(`CSV rows: ${rows.length} → after dedup: ${deduped.length}`);

// ── Connect to DB ─────────────────────────────────────────────────────────────
const conn = await mysql.createConnection(DATABASE_URL);

let inserted = 0;
let skipped = 0;

for (const row of deduped) {
  const email = row.email;
  const twitterHandle = row.twitter || null;
  const telegramHandle = row.telegram || null;
  const testScore = parseInt(row.testScore, 10) || 0;
  const motivation = row.motivation || "";

  // Check if email already exists
  const [existing] = await conn.execute(
    "SELECT id FROM ambassador_applications WHERE email = ? LIMIT 1",
    [email]
  );

  if (existing.length > 0) {
    // Update isEvangelist flag on existing record
    await conn.execute(
      "UPDATE ambassador_applications SET isEvangelist = 1 WHERE email = ?",
      [email]
    );
    console.log(`  UPDATED (existing): ${email}`);
    skipped++;
    continue;
  }

  // Insert new Evangelist record
  // Required NOT NULL fields that we don't have from CSV: tracks, contributionIntent,
  // communities, hasCommunityExperience, protocolDescription, communityBenefit, firstThirtyDays
  // We insert placeholder values so the row is valid; they can be completed via /apply
  await conn.execute(
    `INSERT INTO ambassador_applications
      (email, isEvangelist, lastStep, tracks, contributionIntent, testScore,
       communities, twitterHandle, telegramHandle,
       hasCommunityExperience, protocolDescription, communityBenefit, firstThirtyDays,
       status, createdAt, updatedAt)
     VALUES (?, 1, 'email', '[]', '[]', ?,
             '', ?, ?,
             'no', '', ?, '',
             'pending', NOW(), NOW())`,
    [email, testScore, twitterHandle, telegramHandle, motivation]
  );
  console.log(`  INSERTED: ${email}`);
  inserted++;
}

await conn.end();

console.log(`\nDone. Inserted: ${inserted} | Updated existing: ${skipped} | Total: ${inserted + skipped}`);
