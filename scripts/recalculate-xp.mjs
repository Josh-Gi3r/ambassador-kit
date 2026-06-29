/**
 * Bulk XP Recalculation Script — SCRAPING_SPEC_VERSION: 6.0
 * Matches xpEngine.ts v6.0 and MASTER.md v6.0 Section 4.
 * DO NOT modify without reading MASTER.md Section 4 first.
 *
 * Usage: node scripts/recalculate-xp.mjs
 */
import mysql from 'mysql2/promise';

// ── Component max XP — must match COMPONENT_MAX in xpEngine.ts ────────────────
const COMPONENT_MAX = {
  c1: 20, c2: 10, c3: 10, c4: 15, c5: 5,
  c6: 10, c7: 5,  c8: 10, c9: 5,  c10: 5, c11: 5,
};

function mapAdminScore(raw, max) {
  if (!raw || raw <= 0) return 0;
  return Math.min((raw / 10) * max, max);
}

function applyDecay(xpValue, updatedAt) {
  if (!updatedAt || xpValue <= 0) return xpValue;
  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000);
  const weeksSince = daysSince / 7;
  return Math.max(0, xpValue * Math.pow(0.75, weeksSince));
}

function c1FromPostCount(postCount, c4Raw) {
  let raw;
  if (postCount === 0) raw = 0;
  else if (postCount === 1) raw = 2;
  else if (postCount === 2) raw = 4;
  else if (postCount <= 4) raw = 6;
  else if (postCount <= 7) raw = 8;
  else raw = c4Raw >= 7 ? 10 : 9;
  return raw * 2;
}

function c2FromDays(days) {
  if (days >= 9) return 10;
  if (days >= 6) return 8;
  if (days >= 4) return 6;
  if (days >= 2) return 4;
  if (days >= 1) return 2;
  return 0;
}

function c3RawFromPoints(points) {
  if (points >= 700) return 10;
  if (points >= 401) return 9;
  if (points >= 201) return 8;
  if (points >= 101) return 7;
  if (points >= 51)  return 6;
  if (points >= 21)  return 5;
  if (points >= 6)   return 3;
  if (points >= 1)   return 1;
  return 0;
}

function c5FromMsgCount(msgCount) {
  let raw;
  if (msgCount >= 36) raw = 9;
  else if (msgCount >= 21) raw = 8;
  else if (msgCount >= 11) raw = 6;
  else if (msgCount >= 4)  raw = 4;
  else if (msgCount >= 1)  raw = 2;
  else raw = 0;
  return raw * 0.5;
}

function addXPSnapshot(existing, xp) {
  const today = new Date().toISOString().slice(0, 10);
  const history = existing ?? [];
  const filtered = history.filter(s => s.date !== today);
  filtered.push({ date: today, xp });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  return filtered.slice(-90);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const WINDOW_DAYS = 14;
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowStartStr = windowStart.toISOString().slice(0, 19).replace('T', ' ');

  console.log(`[XP v6.0] Recalculating XP for all ambassadors...`);
  console.log(`[XP v6.0] Rolling window start: ${windowStartStr}`);
  console.log(`[XP v6.0] C3 direction: engagement RECEIVED on ambassador's own posts`);

  // Bulk X activity — C3 direction: RECEIVED on ambassador's own posts (tweetType='post')
  const [xRows] = await conn.execute(`
    SELECT applicationId,
      SUM(CASE WHEN tweetType='post' AND postedAt >= ? THEN 1 ELSE 0 END) AS postCount,
      COUNT(DISTINCT CASE WHEN postedAt >= ? THEN DATE(postedAt) END) AS distinctDays,
      SUM(CASE WHEN tweetType='post' AND postedAt >= ? THEN COALESCE(quotes, 0) ELSE 0 END) AS receivedQuotes,
      SUM(CASE WHEN tweetType='post' AND postedAt >= ? THEN COALESCE(retweets, 0) ELSE 0 END) AS receivedRetweets,
      SUM(CASE WHEN tweetType='post' AND postedAt >= ? THEN COALESCE(replies, 0) ELSE 0 END) AS receivedReplies
    FROM x_activity GROUP BY applicationId
  `, [windowStartStr, windowStartStr, windowStartStr, windowStartStr, windowStartStr]);

  const [tgRows] = await conn.execute(`
    SELECT applicationId, COUNT(*) AS msgCount
    FROM telegram_activity WHERE sentAt >= ? GROUP BY applicationId
  `, [windowStartStr]);

  const xMap = new Map(xRows.map(r => [r.applicationId, r]));
  const tgMap = new Map(tgRows.map(r => [r.applicationId, r]));

  const [ambassadors] = await conn.execute(
    `SELECT * FROM ambassador_applications WHERE status != 'rejected'`
  );

  let updated = 0;
  for (const amb of ambassadors) {
    try {
      const xd = xMap.get(amb.id);
      const tgd = tgMap.get(amb.id);

      const postCount = Number(xd?.postCount ?? 0);
      const c4Raw = Number(amb.c4ContentQuality ?? 0);
      const c1 = c1FromPostCount(postCount, c4Raw);
      const c2 = c2FromDays(Number(xd?.distinctDays ?? 0));

      // C3: engagement RECEIVED (quotes×4 + retweets×3 + replies×2)
      const engPts =
        Number(xd?.receivedQuotes ?? 0) * 4 +
        Number(xd?.receivedRetweets ?? 0) * 3 +
        Number(xd?.receivedReplies ?? 0) * 2;
      const c1RawScore = c1 / 2;
      const c3Cap = c1RawScore <= 2 ? 6 : 10;
      const c3 = Math.min(c3RawFromPoints(engPts), c3Cap);

      const c4 = applyDecay(mapAdminScore(c4Raw, COMPONENT_MAX.c4), amb.c4UpdatedAt);
      const c5 = c5FromMsgCount(Number(tgd?.msgCount ?? 0));
      const c6 = applyDecay(mapAdminScore(Number(amb.c6CommunityValue ?? 0), COMPONENT_MAX.c6), amb.c6UpdatedAt);
      const c7 = mapAdminScore(Number(amb.c7BuilderOutput ?? 0), COMPONENT_MAX.c7);
      const c8 = applyDecay(mapAdminScore(Number(amb.c8BuilderDepth ?? 0), COMPONENT_MAX.c8), amb.c8UpdatedAt);
      const c9 = applyDecay(mapAdminScore(Number(amb.c9EngagementAuth ?? 0), COMPONENT_MAX.c9), amb.c9UpdatedAt);
      const c10 = applyDecay(mapAdminScore(Number(amb.c10MissionAlign ?? 0), COMPONENT_MAX.c10), amb.c10UpdatedAt);
      const c11 = Math.min((Number(amb.testScore ?? 0) / 10) * COMPONENT_MAX.c11, COMPONENT_MAX.c11);

      const totalXP = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;

      const existing = amb.xpSnapshotHistory ? JSON.parse(amb.xpSnapshotHistory) : null;
      const snapshotHistory = addXPSnapshot(existing, totalXP);

      await conn.execute(`
        UPDATE ambassador_applications SET
          xpC1=?, xpC2=?, xpC3=?, xpC4=?, xpC5=?,
          xpC6=?, xpC7=?, xpC8=?, xpC9=?, xpC10=?, xpC11=?,
          totalXP=?, xpTrend=0, xpSnapshotHistory=?, xpUpdatedAt=NOW()
        WHERE id=?
      `, [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11,
          totalXP, JSON.stringify(snapshotHistory), amb.id]);

      console.log(`  [${amb.id}] ${amb.socialHandle || amb.twitterHandle}: XP=${totalXP.toFixed(1)} (C1=${c1} C2=${c2} C3=${c3.toFixed(1)} C4=${c4.toFixed(1)} C5=${c5})`);
      updated++;
    } catch (err) {
      console.error(`  [ERROR] Ambassador ${amb.id}:`, err.message);
    }
  }

  // Print top 10 after recalculation
  const [top] = await conn.execute(
    `SELECT twitterHandle, totalXP, xpC1, xpC2, xpC3, xpC4, xpC5, xpC11
     FROM ambassador_applications WHERE status != 'rejected'
     ORDER BY totalXP DESC LIMIT 10`
  );
  console.log(`\n[XP v6.0] Top 10 after recalculation:`);
  top.forEach(r => console.log(
    `  ${r.twitterHandle}: XP=${Number(r.totalXP).toFixed(1)} C1=${r.xpC1} C2=${r.xpC2} C3=${Number(r.xpC3).toFixed(1)} C4=${Number(r.xpC4).toFixed(1)} C5=${r.xpC5} C11=${Number(r.xpC11).toFixed(1)}`
  ));

  await conn.end();
  console.log(`\n[XP v6.0] Done. Updated ${updated} ambassadors.`);
}

main().catch(err => { console.error(err); process.exit(1); });
