import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const ROLLING_WINDOW_DAYS = 14;
const DECAY_RATE_PER_WEEK = 0.25;
const COMPONENT_MAX = { c1:12, c2:10, c3:14, c4:12, c5:8, c6:10, c7:8, c8:6, c9:8, c10:7, c11:5 };

function applyDecay(rawScore, updatedAt) {
  if (!updatedAt || rawScore <= 0) return 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = (Date.now() - new Date(updatedAt).getTime()) / msPerWeek;
  if (weeksElapsed <= 0) return rawScore;
  return Math.max(0, rawScore * Math.pow(1 - DECAY_RATE_PER_WEEK, weeksElapsed));
}

const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

// Get all ambassadors
const [ambassadors] = await conn.execute(`
  SELECT id, twitterHandle, telegramHandle,
         testScore,
         c4ContentQuality, c4UpdatedAt,
         c6CommunityValue, c6UpdatedAt,
         c7BuilderOutput, c7UpdatedAt,
         c8BuilderDepth, c8UpdatedAt,
         c9EngagementAuth, c9UpdatedAt,
         c10MissionAlign, c10UpdatedAt,
         totalXP as currentXP
  FROM ambassador_applications
  ORDER BY twitterHandle
`);

const results = [];

for (const amb of ambassadors) {
  const id = amb.id;

  // C1 - post frequency
  const [[c1Row]] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM x_activity WHERE applicationId=? AND tweetType='post' AND postedAt >= ?`,
    [id, windowStart]
  );
  const postCount = c1Row.cnt;
  let c1 = 0;
  if (postCount >= 8) c1 = 12;
  else if (postCount >= 6) c1 = 10;
  else if (postCount >= 4) c1 = 8;
  else if (postCount >= 2) c1 = 5;
  else if (postCount >= 1) c1 = 2;

  // C2 - consistency
  const [[c2Row]] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(postedAt)) as days FROM x_activity WHERE applicationId=? AND postedAt >= ?`,
    [id, windowStart]
  );
  const days = c2Row.days;
  let c2 = 0;
  if (days >= 10) c2 = 10;
  else if (days >= 7) c2 = 8;
  else if (days >= 5) c2 = 6;
  else if (days >= 3) c2 = 4;
  else if (days >= 1) c2 = 2;

  // C3 - engagement reach
  const [[c3Row]] = await conn.execute(
    `SELECT SUM(likes) as tl, SUM(retweets) as tr, SUM(replies) as trep,
            SUM(CASE WHEN tweetType='quote' THEN 1 ELSE 0 END) as tq
     FROM x_activity WHERE applicationId=? AND postedAt >= ?`,
    [id, windowStart]
  );
  const engPts = (c3Row.tl||0)*0.5 + (c3Row.tr||0)*1 + (c3Row.trep||0)*3 + (c3Row.tq||0)*2;
  let c3Raw = 0;
  if (engPts >= 100) c3Raw = 14;
  else if (engPts >= 60) c3Raw = 12;
  else if (engPts >= 30) c3Raw = 10;
  else if (engPts >= 15) c3Raw = 8;
  else if (engPts >= 5) c3Raw = 5;
  else if (engPts > 0) c3Raw = 2;
  const c3 = c1 <= 2 ? Math.min(c3Raw, 6) : c3Raw;

  // C4 - content quality (admin, decays)
  const c4 = (applyDecay(amb.c4ContentQuality||0, amb.c4UpdatedAt) / 10) * COMPONENT_MAX.c4;

  // C5 - telegram
  const [[c5Row]] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM telegram_activity WHERE applicationId=? AND sentAt >= ?`,
    [id, windowStart]
  );
  const msgCount = c5Row.cnt;
  let c5 = 0;
  if (msgCount >= 30) c5 = 8;
  else if (msgCount >= 20) c5 = 7;
  else if (msgCount >= 10) c5 = 5;
  else if (msgCount >= 5) c5 = 3;
  else if (msgCount >= 1) c5 = 1;

  // C6-C10 admin scored with decay
  const c6 = (applyDecay(amb.c6CommunityValue||0, amb.c6UpdatedAt) / 10) * COMPONENT_MAX.c6;
  const c7 = Math.min(((amb.c7BuilderOutput||0) / 10) * COMPONENT_MAX.c7, COMPONENT_MAX.c7);
  const c8 = (applyDecay(amb.c8BuilderDepth||0, amb.c8UpdatedAt) / 10) * COMPONENT_MAX.c8;
  const c9 = (applyDecay(amb.c9EngagementAuth||0, amb.c9UpdatedAt) / 10) * COMPONENT_MAX.c9;
  const c10 = (applyDecay(amb.c10MissionAlign||0, amb.c10UpdatedAt) / 10) * COMPONENT_MAX.c10;

  // C11 - test score
  const c11 = Math.min(((amb.testScore||0) / 10) * COMPONENT_MAX.c11, COMPONENT_MAX.c11);

  const totalXP = Math.min(c1+c2+c3+c4+c5+c6+c7+c8+c9+c10+c11, 100);

  results.push({
    handle: amb.twitterHandle || '(no handle)',
    currentXP: Number(amb.currentXP||0).toFixed(1),
    simulatedXP: totalXP.toFixed(1),
    c1_postFreq: c1.toFixed(1),
    c2_consistency: c2.toFixed(1),
    c3_engagement: c3.toFixed(1),
    c4_contentQuality: c4.toFixed(1),
    c5_telegram: c5.toFixed(1),
    c6_communityValue: c6.toFixed(1),
    c7_builderOutput: c7.toFixed(1),
    c8_builderDepth: c8.toFixed(1),
    c9_engagementAuth: c9.toFixed(1),
    c10_missionAlign: c10.toFixed(1),
    c11_testScore: c11.toFixed(1),
    postsIn14d: postCount,
    daysActiveIn14d: days,
    engagementPts: engPts.toFixed(1),
    tgMsgsIn14d: msgCount,
  });
}

await conn.end();

// Sort by simulatedXP desc
results.sort((a,b) => parseFloat(b.simulatedXP) - parseFloat(a.simulatedXP));

// Write CSV
const fs = await import('fs');
const header = Object.keys(results[0]).join(',');
const rows = results.map(r => Object.values(r).map(v => `"${v}"`).join(','));
const csv = [header, ...rows].join('\n');
fs.writeFileSync(process.env.SIMULATION_CSV_PATH ?? './xp_simulation.csv', csv);

console.log('Done! Written to ' + (process.env.SIMULATION_CSV_PATH ?? './xp_simulation.csv'));
console.log('\nTop 10 by simulated XP:');
results.slice(0,10).forEach((r,i) => {
  console.log(`${i+1}. ${r.handle}: ${r.simulatedXP} XP (was: ${r.currentXP}) | C1:${r.c1_postFreq} C2:${r.c2_consistency} C3:${r.c3_engagement} C5:${r.c5_telegram} C11:${r.c11_testScore}`);
});

console.log('\nAll ambassadors with 0 simulated XP:');
results.filter(r => parseFloat(r.simulatedXP) === 0).forEach(r => console.log(`  - ${r.handle}`));
