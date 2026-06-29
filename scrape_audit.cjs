const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Last 30 scrape runs
  const [runs] = await conn.execute(`
    SELECT r.status, r.startedAt, r.completedAt, r.tweetCount, r.errorMessage, a.twitterHandle
    FROM x_scrape_runs r
    JOIN ambassador_applications a ON a.id = r.applicationId
    ORDER BY r.startedAt DESC
    LIMIT 30
  `);
  console.log('=== LAST 30 SCRAPE RUNS ===');
  runs.forEach(r => {
    const dur = r.completedAt && r.startedAt ? Math.round((new Date(r.completedAt) - new Date(r.startedAt))/1000) + 's' : '-';
    console.log(`${r.twitterHandle}: ${r.status} | ${new Date(r.startedAt).toISOString().substring(0,16)} | tweets=${r.tweetCount} | dur=${dur} | err=${r.errorMessage?.substring(0,60)||''}`);
  });

  // Ambassadors with NO scrape runs
  const [noRuns] = await conn.execute(`
    SELECT a.twitterHandle, a.totalXP
    FROM ambassador_applications a
    WHERE a.level >= 1
    AND NOT EXISTS (SELECT 1 FROM x_scrape_runs r WHERE r.applicationId = a.id)
    ORDER BY a.totalXP DESC
  `);
  console.log(`\n=== AMBASSADORS WITH NO SCRAPE RUNS: ${noRuns.length} ===`);
  noRuns.forEach(r => console.log(`  ${r.twitterHandle} XP=${r.totalXP}`));

  // Ambassadors with 0 tweets in DB
  const [noTweets] = await conn.execute(`
    SELECT a.twitterHandle, a.totalXP,
      (SELECT MAX(r.completedAt) FROM x_scrape_runs r WHERE r.applicationId = a.id AND r.status='completed') as lastScraped
    FROM ambassador_applications a
    WHERE a.level >= 1
    AND NOT EXISTS (SELECT 1 FROM x_activity x WHERE x.applicationId = a.id)
    ORDER BY a.totalXP DESC
  `);
  console.log(`\n=== AMBASSADORS WITH 0 TWEETS IN DB: ${noTweets.length} ===`);
  noTweets.forEach(r => console.log(`  ${r.twitterHandle} XP=${r.totalXP} lastScraped=${r.lastScraped}`));

  // Per-ambassador last scrape date
  const [lastScrapes] = await conn.execute(`
    SELECT a.twitterHandle, a.totalXP,
      MAX(r.completedAt) as lastScraped,
      COUNT(r.id) as runCount,
      SUM(CASE WHEN r.status='failed' THEN 1 ELSE 0 END) as failedRuns,
      (SELECT COUNT(*) FROM x_activity x WHERE x.applicationId = a.id) as tweetCount
    FROM ambassador_applications a
    LEFT JOIN x_scrape_runs r ON r.applicationId = a.id
    WHERE a.level >= 1
    GROUP BY a.id
    ORDER BY a.totalXP DESC
  `);
  console.log('\n=== PER-AMBASSADOR SCRAPE SUMMARY ===');
  console.log('Handle | XP | tweets | runs | failed | lastScraped');
  lastScrapes.forEach(r => {
    const ls = r.lastScraped ? new Date(r.lastScraped).toISOString().substring(0,16) : 'NEVER';
    console.log(`${r.twitterHandle} | ${r.totalXP} | ${r.tweetCount} | ${r.runCount} | ${r.failedRuns} | ${ls}`);
  });

  await conn.end();
}
main().catch(console.error);
