import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ws = windowStart.toISOString().slice(0, 19).replace('T', ' ');

  // Get all x_activity columns first
  const [cols] = await conn.execute('SHOW COLUMNS FROM ambassador_applications');
  const colNames = cols.map(c => c.Field);
  const hasLastScraped = colNames.includes('lastScrapedAt');

  const [rows] = await conn.execute(`
    SELECT 
      a.id,
      a.twitterHandle,
      a.totalXP,
      a.xpC1, a.xpC2, a.xpC3, a.xpC4, a.xpC5, a.xpC6, a.xpC9, a.xpC10, a.xpC11,
      a.xpUpdatedAt,
      SUM(CASE WHEN x.tweetType='post' THEN 1 ELSE 0 END) as totalPosts,
      SUM(CASE WHEN x.tweetType='reply' THEN 1 ELSE 0 END) as totalReplies,
      SUM(CASE WHEN x.tweetType='quote' THEN 1 ELSE 0 END) as totalQuotes,
      SUM(CASE WHEN x.tweetType='repost' THEN 1 ELSE 0 END) as totalReposts,
      SUM(x.likes) as totalLikes,
      SUM(CASE WHEN x.tweetType='post' AND x.postedAt >= ? THEN 1 ELSE 0 END) as posts14d,
      COUNT(DISTINCT CASE WHEN x.postedAt >= ? THEN DATE(x.postedAt) END) as activeDays14d,
      SUM(CASE WHEN x.tweetType IN ('reply','quote') AND x.postedAt >= ? THEN 1 ELSE 0 END) as engagement14d,
      SUM(CASE WHEN x.postedAt >= ? THEN x.likes ELSE 0 END) as likes14d,
      SUM(CASE WHEN x.postedAt >= ? THEN x.retweets ELSE 0 END) as retweets14d,
      MAX(x.postedAt) as lastTweet
    FROM ambassador_applications a
    LEFT JOIN x_activity x ON x.applicationId = a.id
    WHERE a.twitterHandle IS NOT NULL AND a.twitterHandle != ''
    GROUP BY a.id, a.twitterHandle, a.totalXP, a.xpC1, a.xpC2, a.xpC3, a.xpC4, a.xpC5, a.xpC6, a.xpC9, a.xpC10, a.xpC11, a.xpUpdatedAt
    ORDER BY a.totalXP DESC
  `, [ws, ws, ws, ws, ws]);

  // Get TG activity
  const [tgRows] = await conn.execute(`
    SELECT applicationId, COUNT(*) as msgCount
    FROM telegram_activity WHERE sentAt >= ? GROUP BY applicationId
  `, [ws]);
  const tgMap = new Map(tgRows.map(r => [r.applicationId, Number(r.msgCount)]));

  // Last scrape job
  const [jobs] = await conn.execute(`SELECT status, createdAt, totalAmbassadors, completedRuns, failedRuns, tweetsImported FROM scrape_jobs ORDER BY createdAt DESC LIMIT 3`);

  console.log('=== LAST 3 SCRAPE JOBS ===');
  jobs.forEach(j => console.log(` ${j.status} | ${new Date(j.createdAt).toLocaleString()} | ambassadors:${j.totalAmbassadors} completed:${j.completedRuns} failed:${j.failedRuns} tweets:${j.tweetsImported}`));

  console.log('\n=== X ACTIVITY AUDIT (14-day window from ' + windowStart.toLocaleDateString() + ') ===');
  console.log('Handle | XP | C1 | C2 | C3 | Posts(14d) | ActiveDays | Engage(14d) | Likes(14d) | TG(14d) | TotalPosts | TotalReplies | TotalLikes | LastTweet');
  console.log('-'.repeat(180));

  rows.forEach(r => {
    const lastTweet = r.lastTweet ? new Date(r.lastTweet).toLocaleDateString() : 'NEVER';
    const tg14d = tgMap.get(r.id) || 0;
    console.log([
      (r.twitterHandle || '').padEnd(20),
      String(Number(r.totalXP).toFixed(1)).padStart(6),
      String(r.xpC1 || 0).padStart(4),
      String(r.xpC2 || 0).padStart(4),
      String(Number(r.xpC3 || 0).toFixed(1)).padStart(5),
      String(r.posts14d || 0).padStart(10),
      String(r.activeDays14d || 0).padStart(10),
      String(r.engagement14d || 0).padStart(11),
      String(r.likes14d || 0).padStart(10),
      String(tg14d).padStart(8),
      String(r.totalPosts || 0).padStart(10),
      String(r.totalReplies || 0).padStart(12),
      String(r.totalLikes || 0).padStart(10),
      lastTweet
    ].join(' | '));
  });

  console.log('\n=== SUMMARY ===');
  console.log('Total ambassadors:', rows.length);
  console.log('Total x_activity rows:', (await conn.execute('SELECT COUNT(*) as c FROM x_activity'))[0][0].c);
  console.log('Ambassadors with 0 posts in 14d:', rows.filter(r => !r.posts14d || r.posts14d == 0).length);
  console.log('Ambassadors with 0 x_activity ever:', rows.filter(r => !r.totalPosts || r.totalPosts == 0).length);
  console.log('Window start (14d ago):', ws);

  await conn.end();
}

main().catch(console.error);
