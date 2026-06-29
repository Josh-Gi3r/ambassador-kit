/**
 * Backfill LiteLLM keys for existing L1+ ambassadors that don't have one.
 *
 * Usage: node scripts/backfill-ai-keys.mjs
 * Requires: DATABASE_URL, LITELLM_URL, LITELLM_MASTER_KEY
 *
 * Tier thresholds mirror server/ai/tierConfig.ts (the single source of
 * truth). Keep in sync if those change.
 */
import mysql from "mysql2/promise";

const { DATABASE_URL, LITELLM_URL, LITELLM_MASTER_KEY } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
if (!LITELLM_URL || !LITELLM_MASTER_KEY) {
  console.error("LITELLM_URL and LITELLM_MASTER_KEY required to issue keys");
  process.exit(1);
}

// Mirror of server/ai/tierConfig.ts resolveTier()
function resolveTier({ level, totalXP, isEvangelist }) {
  if (level < 1) return "none";
  if (isEvangelist) return "elite";
  if (totalXP >= 70) return "elite";
  if (totalXP >= 45) return "active";
  return "starter";
}

async function issueKey(applicationId, handle, tier) {
  const res = await fetch(`${LITELLM_URL}/key/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: String(applicationId),
      key_alias: `ambassador-${tier}-${applicationId}`,
      budget_id: tier,
      metadata: { applicationId, handle, tier },
    }),
  });
  if (!res.ok) throw new Error(`key/generate ${res.status}`);
  const data = await res.json();
  return data.key ?? null;
}

const conn = await mysql.createConnection(DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT id, level, totalXP, isEvangelist, twitterHandle, ai_tier
   FROM ambassador_applications
   WHERE level >= 1 AND (litellm_key IS NULL OR litellm_key = '')`,
);

console.log(`Found ${rows.length} L1+ ambassadors without a key.`);
let issued = 0;
for (const r of rows) {
  const tier = resolveTier({
    level: Number(r.level),
    totalXP: Number(r.totalXP),
    isEvangelist: !!Number(r.isEvangelist),
  });
  if (tier === "none") continue;
  try {
    const key = await issueKey(r.id, r.twitterHandle ?? String(r.id), tier);
    if (!key) continue;
    await conn.execute(
      `UPDATE ambassador_applications
       SET litellm_key = ?, litellm_key_issued_at = NOW(), ai_tier = ?
       WHERE id = ?`,
      [key, tier, r.id],
    );
    issued++;
    console.log(`  #${r.id} → ${tier}`);
  } catch (e) {
    console.warn(`  #${r.id} failed:`, e.message);
  }
}
console.log(`Done. Issued ${issued} keys.`);
await conn.end();
