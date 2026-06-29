import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { calculateC1, calculateC2, calculateC3, calculateC4, calculateC5, calculateC6, calculateC7, calculateC8, calculateC9, calculateC10, calculateC11, COMPONENT_MAX, applyDecay, mapAdminScore } from "../server/xpEngine";
import { ambassadorApplications, xActivity, telegramActivity } from "../drizzle/schema";
import { eq, inArray, and, gte } from "drizzle-orm";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(conn);

const handles = ["@MikusLP", "@mohils_eth", "@shriyash_soni"];
const apps = await db.select().from(ambassadorApplications)
  .where(inArray(ambassadorApplications.twitterHandle, handles));

const WINDOW_DAYS = 14;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

for (const app of apps) {
  const tweets = await db.select().from(xActivity).where(eq(xActivity.applicationId, app.id));
  const tgMsgs = await db.select().from(telegramActivity)
    .where(and(eq(telegramActivity.applicationId, app.id), gte(telegramActivity.sentAt, windowStart)));

  const outbound = tweets.filter(t => t.pipeline === "outbound");
  const inbound = tweets.filter(t => t.pipeline?.startsWith("inbound"));
  const recentOutbound = outbound.filter(t => t.postedAt && new Date(t.postedAt) >= windowStart);
  const recentInbound = inbound.filter(t => t.postedAt && new Date(t.postedAt) >= windowStart);
  const recentPosts = recentOutbound.filter(t => t.tweetType === "post");
  const recentReplies = recentOutbound.filter(t => t.tweetType === "reply");
  const recentQuotes = recentOutbound.filter(t => t.tweetType === "quote");
  const recentRetweets = recentOutbound.filter(t => t.tweetType === "retweet");

  const c1 = await calculateC1(app.id, app.c4ContentQuality ?? 0);
  const c2 = await calculateC2(app.id);
  const c3 = await calculateC3(app.id, c1);
  const c4 = calculateC4(app.c4ContentQuality ?? 0, app.c4UpdatedAt);
  const c5 = await calculateC5(app.id);
  const c6 = calculateC6(app.c6CommunityValue ?? 0, app.c6UpdatedAt);
  const c7 = calculateC7(app.c7BuilderOutput ?? 0, app.c7UpdatedAt);
  const c8 = calculateC8(app.c8BuilderDepth ?? 0, app.c8UpdatedAt);
  const c9 = calculateC9(app.c9EngagementAuth ?? 0, app.c9UpdatedAt);
  const c10 = calculateC10(app.c10MissionAlign ?? 0, app.c10UpdatedAt);
  const c11 = calculateC11(app.testScore ?? 0);
  const total = c1+c2+c3+c4+c5+c6+c7+c8+c9+c10+c11;

  console.log(`\n=== ${app.twitterHandle} ===`);
  console.log(`14d window: posts=${recentPosts.length} replies=${recentReplies.length} quotes=${recentQuotes.length} retweets=${recentRetweets.length} | inbound engagements=${recentInbound.length}`);
  console.log(`TG msgs(14d): ${tgMsgs.length}`);
  console.log(`Admin scores: C4raw=${app.c4ContentQuality} C6raw=${app.c6CommunityValue} C7raw=${app.c7BuilderOutput} C8raw=${app.c8BuilderDepth} C9raw=${app.c9EngagementAuth} C10raw=${app.c10MissionAlign} test=${app.testScore}`);
  console.log(`XP: C1=${c1}/${COMPONENT_MAX.c1} C2=${c2}/${COMPONENT_MAX.c2} C3=${c3}/${COMPONENT_MAX.c3} C4=${c4.toFixed(2)}/${COMPONENT_MAX.c4} C5=${c5}/${COMPONENT_MAX.c5} C6=${c6.toFixed(2)}/${COMPONENT_MAX.c6} C7=${c7}/${COMPONENT_MAX.c7} C8=${c8.toFixed(2)}/${COMPONENT_MAX.c8} C9=${c9.toFixed(2)}/${COMPONENT_MAX.c9} C10=${c10.toFixed(2)}/${COMPONENT_MAX.c10} C11=${c11}/${COMPONENT_MAX.c11}`);
  console.log(`TOTAL: ${total.toFixed(2)} (stored: ${app.totalXP})`);
}

await conn.end();
process.exit(0);
