const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // ── 1. Export all posts to CSV ────────────────────────────────────────────
  const [posts] = await conn.execute(`
    SELECT 
      a.twitterHandle,
      x.tweetId,
      x.tweetType,
      x.postedAt,
      x.likes,
      x.retweets,
      x.replies,
      x.bookmarks,
      x.quotedFrom,
      x.tweetUrl,
      x.text
    FROM x_activity x
    JOIN ambassador_applications a ON a.id = x.applicationId
    ORDER BY a.twitterHandle, x.postedAt DESC
  `);

  const header = 'handle,tweetId,type,postedAt,likes,retweets,replies,bookmarks,quotedFrom,url,text';
  const lines = posts.map(r => {
    const text = (r.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const dt = r.postedAt ? new Date(r.postedAt).toISOString() : '';
    return `"${r.twitterHandle}","${r.tweetId}","${r.tweetType}","${dt}",${r.likes},${r.retweets},${r.replies},${r.bookmarks},"${r.quotedFrom || ''}","${r.tweetUrl || ''}","${text}"`;
  });
  fs.writeFileSync(process.env.EXPORT_CSV_PATH ?? './all_posts.csv', [header, ...lines].join('\n'));
  console.log('Total posts exported:', posts.length);

  // ── 2. Summary per ambassador ─────────────────────────────────────────────
  const summary = new Map();
  for (const r of posts) {
    const h = r.twitterHandle;
    if (!summary.has(h)) summary.set(h, { post: 0, reply: 0, quote: 0, retweet: 0, total: 0 });
    const s = summary.get(h);
    s[r.tweetType] = (s[r.tweetType] || 0) + 1;
    s.total++;
  }
  console.log('\nPosts per ambassador (sorted by total):');
  [...summary.entries()].sort((a, b) => b[1].total - a[1].total).forEach(([h, s]) => {
    console.log(`  ${h}: total=${s.total} posts=${s.post||0} replies=${s.reply||0} quotes=${s.quote||0} retweets=${s.retweet||0}`);
  });

  // ── 3. XP audit: stored vs recalculated ──────────────────────────────────
  const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [ambassadors] = await conn.execute(`
    SELECT 
      a.id, a.twitterHandle, a.totalXP,
      a.xpC1, a.xpC2, a.xpC3, a.xpC4, a.xpC5,
      a.xpC6, a.xpC7, a.xpC8, a.xpC9, a.xpC10, a.xpC11,
      a.c4ContentQuality, a.c6CommunityValue, a.c7BuilderOutput,
      a.c8BuilderDepth, a.c9EngagementAuth, a.c10MissionAlign,
      a.testScore, a.xpUpdatedAt,
      COUNT(CASE WHEN x.tweetType = 'post' AND x.postedAt >= ? THEN 1 END) as postsWin,
      COUNT(CASE WHEN x.postedAt >= ? THEN 1 END) as allWin,
      COUNT(CASE WHEN (x.tweetType = 'reply' OR x.tweetType = 'quote') AND x.postedAt >= ? THEN 1 END) as engagementsGiven,
      COALESCE(SUM(CASE WHEN x.postedAt >= ? THEN x.replies END), 0) as totalRepliesRec,
      COALESCE(SUM(CASE WHEN x.postedAt >= ? THEN x.retweets END), 0) as totalRetweetsRec,
      COALESCE(SUM(CASE WHEN x.postedAt >= ? THEN x.likes END), 0) as totalLikesRec,
      COUNT(DISTINCT CASE WHEN x.postedAt >= ? THEN DATE(x.postedAt) END) as distinctDays,
      COUNT(x.id) as totalTweets
    FROM ambassador_applications a
    LEFT JOIN x_activity x ON x.applicationId = a.id
    WHERE a.level >= 1
    GROUP BY a.id
    ORDER BY a.totalXP DESC
  `, [windowStart, windowStart, windowStart, windowStart, windowStart, windowStart, windowStart]);

  // Recalculate C1-C3 from raw data
  function calcC1(postCount) {
    if (postCount >= 8) return 12;
    if (postCount >= 6) return 10;
    if (postCount >= 4) return 8;
    if (postCount >= 2) return 5;
    if (postCount >= 1) return 2;
    return 0;
  }
  function calcC2(days) {
    if (days >= 10) return 10;
    if (days >= 7) return 8;
    if (days >= 5) return 6;
    if (days >= 3) return 4;
    if (days >= 1) return 2;
    return 0;
  }
  function calcC3(givenCount, totalReplies, totalRetweets, totalLikes) {
    let bucketA = 0;
    if (givenCount >= 20) bucketA = 8;
    else if (givenCount >= 12) bucketA = 6;
    else if (givenCount >= 6) bucketA = 4;
    else if (givenCount >= 3) bucketA = 2;
    else if (givenCount >= 1) bucketA = 1;
    const receivedPoints = totalReplies * 3 + totalRetweets * 1 + totalLikes * 0.5;
    let bucketB = 0;
    if (receivedPoints >= 100) bucketB = 2;
    else if (receivedPoints >= 30) bucketB = 1.5;
    else if (receivedPoints >= 10) bucketB = 1;
    else if (receivedPoints > 0) bucketB = 0.5;
    return bucketA + bucketB;
  }
  function mapAdmin(raw, max) {
    if (!raw || raw <= 0) return 0;
    return Math.min((raw / 10) * max, max);
  }
  function calcC11(testScore) {
    if (!testScore || testScore <= 0) return 0;
    return Math.min((testScore / 10) * 5, 5);
  }

  console.log('\n=== XP AUDIT: Stored vs Recalculated ===');
  console.log('Handle | StoredXP | CalcXP | C1s/C1c | C2s/C2c | C3s/C3c | postsWin | engGiven | distinctDays | c4raw | c6raw | c9raw | c10raw | ISSUE?');

  const auditLines = ['handle,storedXP,calcXP,C1stored,C1calc,C2stored,C2calc,C3stored,C3calc,C4stored,C5stored,C6stored,C9stored,C10stored,C11stored,postsInWindow,engagementsGiven,distinctDays,totalTweets,c4raw,c6raw,c9raw,c10raw,testScore,issue'];

  for (const a of ambassadors) {
    const c1c = calcC1(Number(a.postsWin));
    const c2c = calcC2(Number(a.distinctDays));
    const c3c = calcC3(Number(a.engagementsGiven), Number(a.totalRepliesRec), Number(a.totalRetweetsRec), Number(a.totalLikesRec));
    const c4c = mapAdmin(a.c4ContentQuality, 12);
    const c5c = Number(a.xpC5); // TG - not recalculating here
    const c6c = mapAdmin(a.c6CommunityValue, 10);
    const c7c = mapAdmin(a.c7BuilderOutput, 8);
    const c8c = mapAdmin(a.c8BuilderDepth, 6);
    const c9c = mapAdmin(a.c9EngagementAuth, 8);
    const c10c = mapAdmin(a.c10MissionAlign, 7);
    const c11c = calcC11(a.testScore);
    const calcTotal = c1c + c2c + c3c + c4c + c5c + c6c + c7c + c8c + c9c + c10c + c11c;
    const stored = Number(a.totalXP);
    const diff = Math.abs(calcTotal - stored);
    const issue = diff > 0.5 ? `MISMATCH(${diff.toFixed(1)})` : 'OK';

    console.log(`${a.twitterHandle} | stored=${stored.toFixed(1)} | calc=${calcTotal.toFixed(1)} | C1:${Number(a.xpC1).toFixed(0)}/${c1c} | C2:${Number(a.xpC2).toFixed(0)}/${c2c} | C3:${Number(a.xpC3).toFixed(1)}/${c3c.toFixed(1)} | posts=${a.postsWin} | eng=${a.engagementsGiven} | days=${a.distinctDays} | c4raw=${a.c4ContentQuality||0} c6raw=${a.c6CommunityValue||0} c9raw=${a.c9EngagementAuth||0} c10raw=${a.c10MissionAlign||0} | ${issue}`);

    auditLines.push(`"${a.twitterHandle}",${stored.toFixed(2)},${calcTotal.toFixed(2)},${Number(a.xpC1).toFixed(2)},${c1c},${Number(a.xpC2).toFixed(2)},${c2c},${Number(a.xpC3).toFixed(2)},${c3c.toFixed(2)},${Number(a.xpC4).toFixed(2)},${Number(a.xpC5).toFixed(2)},${Number(a.xpC6).toFixed(2)},${Number(a.xpC9).toFixed(2)},${Number(a.xpC10).toFixed(2)},${Number(a.xpC11).toFixed(2)},${a.postsWin},${a.engagementsGiven},${a.distinctDays},${a.totalTweets},${a.c4ContentQuality||0},${a.c6CommunityValue||0},${a.c9EngagementAuth||0},${a.c10MissionAlign||0},${a.testScore||0},"${issue}"`);
  }

  fs.writeFileSync(process.env.AUDIT_CSV_PATH ?? './xp_audit.csv', auditLines.join('\n'));
  console.log('\nAudit CSV written to ' + (process.env.AUDIT_CSV_PATH ?? './xp_audit.csv'));

  await conn.end();
}

main().catch(console.error);
