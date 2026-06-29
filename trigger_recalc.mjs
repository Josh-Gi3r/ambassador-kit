// Trigger recalculateAllXP via the live server's internal DB connection
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Replicate the C1/C2/C3 calculation and update totalXP for all ambassadors
// We call the stored procedure equivalent by running the xpEngine logic directly

// Get all ambassadors
const [ambassadors] = await db.query(`SELECT id FROM ambassador_applications`);
console.log(`Recalculating XP for ${ambassadors.length} ambassadors...`);

const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
let updated = 0;

for (const amb of ambassadors) {
  const id = amb.id;
  
  // Get tweets in 14-day window
  const [tweets] = await db.query(
    `SELECT tweetId, tweetType, likes, retweets, replies, bookmarks, postedAt 
     FROM x_activity 
     WHERE applicationId = ? AND postedAt >= ?`,
    [id, windowStart]
  );

  // C1: Post frequency (posts only, not retweets)
  const posts = tweets.filter(t => t.tweetType === 'post' || t.tweetType === 'reply' || t.tweetType === 'quote');
  const postCount = posts.length;
  let c1 = 0;
  if (postCount >= 8) c1 = 12;
  else if (postCount >= 6) c1 = 10;
  else if (postCount >= 4) c1 = 8;
  else if (postCount >= 2) c1 = 5;
  else if (postCount >= 1) c1 = 3;

  // C2: Posting spread (distinct days)
  const days = new Set(tweets.map(t => new Date(t.postedAt).toDateString()));
  const dayCount = days.size;
  let c2 = 0;
  if (dayCount >= 10) c2 = 10;
  else if (dayCount >= 7) c2 = 8;
  else if (dayCount >= 5) c2 = 6;
  else if (dayCount >= 3) c2 = 4;
  else if (dayCount >= 1) c2 = 2;

  // C3: Engagement reach
  const totalEng = tweets.reduce((sum, t) => sum + (t.likes || 0) + (t.retweets || 0) * 2 + (t.replies || 0) * 1.5 + (t.bookmarks || 0), 0);
  let c3 = 0;
  if (totalEng >= 200) c3 = 14;
  else if (totalEng >= 100) c3 = 12;
  else if (totalEng >= 50) c3 = 10;
  else if (totalEng >= 20) c3 = 7;
  else if (totalEng >= 5) c3 = 4;
  else if (totalEng >= 1) c3 = 2;

  // Get existing admin scores (C4-C11) - don't touch those
  const [existing] = await db.query(
    `SELECT xpC1, xpC2, xpC3, xpC4, xpC5, xpC6, xpC7, xpC8, xpC9, xpC10, xpC11, totalXP FROM ambassador_applications WHERE id = ?`,
    [id]
  );
  
  if (!existing.length) continue;
  const row = existing[0];
  
  // Recalculate total with new C1/C2/C3 + existing C4-C11
  const c4 = parseFloat(row.xpC4) || 0;
  const c5 = parseFloat(row.xpC5) || 0;
  const c6 = parseFloat(row.xpC6) || 0;
  const c7 = parseFloat(row.xpC7) || 0;
  const c8 = parseFloat(row.xpC8) || 0;
  const c9 = parseFloat(row.xpC9) || 0;
  const c10 = parseFloat(row.xpC10) || 0;
  const c11 = parseFloat(row.xpC11) || 0;
  
  const newTotal = c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11;
  
  await db.query(
    `UPDATE ambassador_applications SET xpC1=?, xpC2=?, xpC3=?, totalXP=?, xpUpdatedAt=NOW() WHERE id=?`,
    [c1, c2, c3, newTotal, id]
  );
  updated++;
}

console.log(`Done. Updated ${updated} ambassadors.`);

// Show top 10
const [top] = await db.query(
  `SELECT twitterHandle, totalXP, xpC1, xpC2, xpC3 FROM ambassador_applications ORDER BY totalXP DESC LIMIT 10`
);
console.log('\nTop 10:');
top.forEach((r, i) => console.log(`${i+1}. ${r.twitterHandle}: ${r.totalXP} XP (C1=${r.xpC1}, C2=${r.xpC2}, C3=${r.xpC3})`));

await db.end();
