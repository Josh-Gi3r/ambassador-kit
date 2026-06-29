/**
 * XP SIMULATION FROM STAGING DATA
 * Calculates C1, C2, C3 from x_activity_staging
 * Uses existing C4-C11 from ambassador_applications (admin scores + test scores)
 * Outputs comparison CSV: old totalXP vs new simulated totalXP
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

// XP Engine constants (from xpEngine.ts)
const NOW = new Date();
const WINDOW_14_DAYS = 14 * 24 * 60 * 60 * 1000;
const WINDOW_START = new Date(NOW.getTime() - WINDOW_14_DAYS);

// C1: Post frequency (posts in 14-day window)
function calcC1(postCount) {
  if (postCount === 0) return 0;
  if (postCount === 1) return 3;
  if (postCount <= 3) return 5;
  if (postCount <= 5) return 8;
  if (postCount <= 7) return 10;
  return 12; // 8+
}

// C2: Posting spread (distinct days with posts in 14-day window)
function calcC2(distinctDays) {
  if (distinctDays === 0) return 0;
  if (distinctDays === 1) return 2;
  if (distinctDays <= 3) return 4;
  if (distinctDays <= 5) return 6;
  if (distinctDays <= 7) return 8;
  if (distinctDays <= 9) return 9;
  return 10; // 10+
}

// C3: Engagement reach (total engagement score in 14-day window)
function calcC3(totalEngagement) {
  if (totalEngagement === 0) return 0;
  if (totalEngagement < 10) return 2;
  if (totalEngagement < 25) return 4;
  if (totalEngagement < 50) return 6;
  if (totalEngagement < 100) return 8;
  if (totalEngagement < 200) return 10;
  if (totalEngagement < 400) return 12;
  return 14; // 400+
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get all ambassadors with their current XP breakdown
  const [ambassadors] = await conn.execute(`
    SELECT id, twitterHandle, totalXP, 
           xpC1, xpC2, xpC3, xpC4, xpC5, xpC6, xpC7, xpC8, xpC9, xpC10, xpC11,
           xpTrend, xpUpdatedAt
    FROM ambassador_applications
    ORDER BY totalXP DESC
  `);

  // Get staging tweet stats per ambassador (14-day window)
  const [stagingStats] = await conn.execute(`
    SELECT 
      applicationId,
      COUNT(*) as totalTweets,
      COUNT(DISTINCT DATE(postedAt)) as distinctDays,
      SUM(engagementScore) as totalEngagement,
      SUM(likes) as totalLikes,
      SUM(retweets) as totalRetweets,
      SUM(replies) as totalReplies,
      SUM(quotes) as totalQuotes
    FROM x_activity_staging
    WHERE postedAt >= ?
    GROUP BY applicationId
  `, [WINDOW_START]);

  const statsMap = {};
  for (const s of stagingStats) {
    statsMap[s.applicationId] = s;
  }

  // Build comparison
  const rows = [];
  for (const amb of ambassadors) {
    const stats = statsMap[amb.id] || { totalTweets: 0, distinctDays: 0, totalEngagement: 0 };
    
    const newC1 = calcC1(stats.totalTweets);
    const newC2 = calcC2(stats.distinctDays);
    const newC3 = calcC3(Number(stats.totalEngagement) || 0);
    
    // Keep existing C4-C11 (admin scores + test score)
    const c4 = Number(amb.xpC4) || 0;
    const c5 = Number(amb.xpC5) || 0;
    const c6 = Number(amb.xpC6) || 0;
    const c7 = Number(amb.xpC7) || 0;
    const c8 = Number(amb.xpC8) || 0;
    const c9 = Number(amb.xpC9) || 0;
    const c10 = Number(amb.xpC10) || 0;
    const c11 = Number(amb.xpC11) || 0;
    
    const newTotal = newC1 + newC2 + newC3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;
    const oldTotal = Number(amb.totalXP) || 0;
    const diff = newTotal - oldTotal;
    
    rows.push({
      handle: amb.twitterHandle,
      oldRank: 0, // filled after sort
      newRank: 0,
      oldTotal,
      newTotal,
      diff,
      // Old C1-C3
      oldC1: Number(amb.xpC1) || 0,
      oldC2: Number(amb.xpC2) || 0,
      oldC3: Number(amb.xpC3) || 0,
      // New C1-C3
      newC1,
      newC2,
      newC3,
      // Staging stats
      tweetsInWindow: stats.totalTweets,
      distinctDays: stats.distinctDays,
      totalEngagement: Number(stats.totalEngagement) || 0,
      // C4-C11 unchanged
      c4, c5, c6, c7, c8, c9, c10, c11,
    });
  }

  // Assign old ranks (by oldTotal desc)
  rows.sort((a, b) => b.oldTotal - a.oldTotal);
  rows.forEach((r, i) => r.oldRank = i + 1);

  // Assign new ranks (by newTotal desc)
  const byNew = [...rows].sort((a, b) => b.newTotal - a.newTotal);
  byNew.forEach((r, i) => r.newRank = i + 1);

  // Sort by new rank for output
  byNew.sort((a, b) => a.newRank - b.newRank);

  // Write CSV
  const header = 'newRank,oldRank,rankChange,handle,oldTotal,newTotal,diff,oldC1,newC1,oldC2,newC2,oldC3,newC3,tweetsInWindow,distinctDays,totalEngagement,c4,c5,c6,c7,c8,c9,c10,c11';
  const lines = byNew.map(r => [
    r.newRank,
    r.oldRank,
    r.oldRank - r.newRank, // positive = moved up
    r.handle,
    r.oldTotal.toFixed(2),
    r.newTotal.toFixed(2),
    r.diff.toFixed(2),
    r.oldC1.toFixed(2),
    r.newC1.toFixed(2),
    r.oldC2.toFixed(2),
    r.newC2.toFixed(2),
    r.oldC3.toFixed(2),
    r.newC3.toFixed(2),
    r.tweetsInWindow,
    r.distinctDays,
    r.totalEngagement.toFixed(2),
    r.c4.toFixed(2),
    r.c5.toFixed(2),
    r.c6.toFixed(2),
    r.c7.toFixed(2),
    r.c8.toFixed(2),
    r.c9.toFixed(2),
    r.c10.toFixed(2),
    r.c11.toFixed(2),
  ].join(',')).join('\n');

  const csvPath = process.env.COMPARISON_CSV_PATH ?? './xp_comparison.csv';
  fs.writeFileSync(csvPath, header + '\n' + lines);

  await conn.end();

  // Print summary
  console.log('=== XP SIMULATION RESULTS ===');
  console.log(`Window: ${WINDOW_START.toISOString().slice(0,10)} to ${NOW.toISOString().slice(0,10)}`);
  console.log(`Ambassadors with staging tweets: ${Object.keys(statsMap).length}`);
  console.log('');
  console.log('NEW RANKING (top 20):');
  console.log('Rank | Handle                    | Old XP | New XP | Diff | Tweets | Days');
  console.log('-----|---------------------------|--------|--------|------|--------|-----');
  byNew.slice(0, 20).forEach(r => {
    const rankChange = r.oldRank - r.newRank;
    const arrow = rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : '=';
    console.log(
      `${String(r.newRank).padStart(4)} | ${r.handle.padEnd(25)} | ${String(r.oldTotal.toFixed(0)).padStart(6)} | ${String(r.newTotal.toFixed(0)).padStart(6)} | ${String(r.diff.toFixed(0)).padStart(4)} | ${String(r.tweetsInWindow).padStart(6)} | ${r.distinctDays} ${arrow}`
    );
  });

  console.log(`\nFull CSV saved to: ${csvPath}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
