import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all ambassadors
const [ambassadors] = await conn.execute(
  `SELECT id, testScore,
   c4ContentQuality, c4UpdatedAt,
   c6CommunityValue, c6UpdatedAt,
   c7BuilderOutput, c7UpdatedAt,
   c8BuilderDepth, c8UpdatedAt,
   c9EngagementAuth, c9UpdatedAt,
   c10MissionAlign, c10UpdatedAt,
   xpSnapshotHistory
   FROM ambassador_applications`
);

console.log(`Processing ${ambassadors.length} ambassadors...`);

let updated = 0;
for (const amb of ambassadors) {
  const id = amb.id;
  
  // C1 - X post output (posts in last 14 days)
  const [c1rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM x_activity WHERE applicationId = ? AND tweetType = 'tweet' AND postedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)`,
    [id]
  );
  const postsLast14 = Number(c1rows[0].cnt);
  // Score: 0=0, 1-2=4, 3-4=8, 5-6=12, 7-9=16, 10+=20
  let c1 = 0;
  if (postsLast14 >= 10) c1 = 20;
  else if (postsLast14 >= 7) c1 = 16;
  else if (postsLast14 >= 5) c1 = 12;
  else if (postsLast14 >= 3) c1 = 8;
  else if (postsLast14 >= 1) c1 = 4;

  // C2 - posting spread (distinct days posted in last 14 days)
  const [c2rows] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(postedAt)) as days FROM x_activity WHERE applicationId = ? AND tweetType = 'tweet' AND postedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)`,
    [id]
  );
  const distinctDays = Number(c2rows[0].days);
  // Score: 0=0, 1-2=2, 3-4=4, 5-6=6, 7-9=8, 10+=10
  let c2 = 0;
  if (distinctDays >= 10) c2 = 10;
  else if (distinctDays >= 7) c2 = 8;
  else if (distinctDays >= 5) c2 = 6;
  else if (distinctDays >= 3) c2 = 4;
  else if (distinctDays >= 1) c2 = 2;

  // C3 - engagement received (likes + replies + quotes + reposts in last 14 days)
  const [c3rows] = await conn.execute(
    `SELECT COALESCE(SUM(likes),0) as likes, COALESCE(SUM(replies),0) as replies, COALESCE(SUM(retweets),0) as reposts FROM x_activity WHERE applicationId = ? AND postedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)`,
    [id]
  );
  const engagementScore = Number(c3rows[0].likes) + (Number(c3rows[0].replies) * 2) + (Number(c3rows[0].reposts) * 2);
  // Score: 0=0, 1-10=2, 11-30=4, 31-60=6, 61-100=8, 100+=10
  let c3 = 0;
  if (engagementScore >= 100) c3 = 10;
  else if (engagementScore >= 61) c3 = 8;
  else if (engagementScore >= 31) c3 = 6;
  else if (engagementScore >= 11) c3 = 4;
  else if (engagementScore >= 1) c3 = 2;

  // C4 - content quality (admin scored, with decay, max 15)
  function decayScore(raw, updatedAt, max) {
    if (!raw || raw === 0) return 0;
    let score = Number(raw);
    if (updatedAt) {
      const weeksSince = (Date.now() - new Date(updatedAt).getTime()) / (7 * 24 * 60 * 60 * 1000);
      score = score * Math.pow(0.75, weeksSince);
    }
    return Math.min(max, Math.max(0, Math.round(score * 10) / 10));
  }
  const c4 = decayScore(amb.c4ContentQuality, amb.c4UpdatedAt, 15);

  // C5 - Telegram participation (messages in last 14 days)
  const [c5rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM telegram_activity WHERE applicationId = ? AND sentAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)`,
    [id]
  );
  const tgMessages = Number(c5rows[0].cnt);
  // Score: 0=0, 1-5=1, 6-15=2, 16-30=3, 31-50=4, 50+=5
  let c5 = 0;
  if (tgMessages >= 50) c5 = 5;
  else if (tgMessages >= 31) c5 = 4;
  else if (tgMessages >= 16) c5 = 3;
  else if (tgMessages >= 6) c5 = 2;
  else if (tgMessages >= 1) c5 = 1;

  // C6-C10 - admin scored with decay
  const c6 = decayScore(amb.c6CommunityValue, amb.c6UpdatedAt, 10);
  const c7 = decayScore(amb.c7BuilderOutput, amb.c7UpdatedAt, 5);
  const c8 = decayScore(amb.c8BuilderDepth, amb.c8UpdatedAt, 10);
  const c9 = decayScore(amb.c9EngagementAuth, amb.c9UpdatedAt, 5);
  const c10 = decayScore(amb.c10MissionAlign, amb.c10UpdatedAt, 5);

  // C11 - application quality (test score, no decay)
  const testScore = amb.testScore || 0;
  const c11 = Math.round((testScore / 10) * 5 * 10) / 10; // max 5

  const totalXP = Math.round((c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11) * 10) / 10;

  await conn.execute(
    `UPDATE ambassador_applications SET xpC1=?, xpC2=?, xpC3=?, xpC4=?, xpC5=?, xpC6=?, xpC7=?, xpC8=?, xpC9=?, xpC10=?, xpC11=?, totalXP=?, xpUpdatedAt=NOW() WHERE id=?`,
    [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, totalXP, id]
  );
  updated++;
}

console.log(`Updated ${updated} ambassadors`);

// Show top 10
const [top] = await conn.execute('SELECT id, twitterHandle, email, totalXP, xpC1, xpC2, xpC3, xpC11, isEvangelist FROM ambassador_applications ORDER BY totalXP DESC LIMIT 15');
console.log('\nTop 10 by XP:');
top.forEach((r, i) => console.log(`${i+1}. ${r.twitterHandle || r.email}${r.isEvangelist ? ' ⚡' : ''} — XP: ${r.totalXP} (C1:${r.xpC1} C2:${r.xpC2} C3:${r.xpC3} C11:${r.xpC11})`));

await conn.end();
