import {
  int,
  bigint,
  mysqlEnum,
  mysqlTable,
  text,
  mediumtext,
  timestamp,
  varchar,
  json,
  float,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  telegramId: varchar("telegramId", { length: 64 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── AMBASSADOR APPLICATIONS ──────────────────────────────────────────────────
export const ambassadorApplications = mysqlTable("ambassador_applications", {
  id: int("id").autoincrement().primaryKey(),
  // Applicant email (used for entry gate, resume, and Evangelist lookup)
  email: varchar("email", { length: 320 }).notNull().default(""),
  // Whether this applicant was found in the Evangelist CSV import
  isEvangelist: int("isEvangelist").default(0).notNull(), // 0 = false, 1 = true
  // Last completed step (for resume logic)
  lastStep: varchar("lastStep", { length: 64 }).default("email").notNull(),
  // Track selection (JSON array: ["community","developer","content"])
  tracks: json("tracks").notNull(),
  // Contribution intent (JSON array of selected options)
  contributionIntent: json("contributionIntent").notNull(),
  // Knowledge test score (0–10)
  testScore: int("testScore").notNull(),
  // Application answers
  communities: text("communities").notNull(),
  twitterHandle: varchar("twitterHandle", { length: 255 }),
  telegramHandle: varchar("telegramHandle", { length: 255 }),
  githubHandle: varchar("githubHandle", { length: 255 }),
  otherLinks: text("otherLinks"),
  hasCommunityExperience: mysqlEnum("hasCommunityExperience", ["yes", "no"]).notNull(),
  communityLinks: json("communityLinks"), // [{url, description}]
  protocolDescription: text("protocolDescription").notNull(),
  communityBenefit: text("communityBenefit").notNull(),
  firstThirtyDays: text("firstThirtyDays").notNull(),
  // Status lifecycle
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  // Admin notes
  adminNotes: text("adminNotes"),

  // ── RANKING & GAMIFICATION ────────────────────────────────────────────────
  // Program level: 0=applicant, 1=contributor, 2=ambassador, 3=lead, 4=ecosystem, 5=fulltime
  level: int("level").default(0).notNull(),
  // Whether this person is flagged as a Token2049 Evangelist candidate (top 12)
  evangelistCandidate: int("evangelistCandidate").default(0).notNull(), // 0=no, 1=yes
  // Manual scores set by admin (0–10 each)
  xContentScore: float("xContentScore").default(0).notNull(),       // Quality of X posts about the protocol
  xEngagementScore: float("xEngagementScore").default(0).notNull(), // Real reach: likes+replies+reposts
  xConsistencyScore: float("xConsistencyScore").default(0).notNull(), // Posting consistently over weeks
  communityContribScore: float("communityContribScore").default(0).notNull(), // Helping others: likes, replies, TG
  tgActivityScore: float("tgActivityScore").default(0).notNull(),   // Telegram group activity
  adminOverrideScore: float("adminOverrideScore").default(0).notNull(), // Admin manual bonus/penalty (-10 to +10)
  // Computed total score (cached, recalculated on score update)
  totalScore: float("totalScore").default(0).notNull(),
  // Score trend: -1=dropping, 0=flat, 1=climbing
  scoreTrend: int("scoreTrend").default(0).notNull(),
  // Weekly score snapshots for trend calculation: [{week: "2026-W11", score: 42.5}, ...]
  weeklyScores: json("weeklyScores"),
  // Earned badges: array of badge keys e.g. ["knowledgeable","consistent","amplifier"]
  badges: json("badges"),
   // Score last updated timestamp
  scoreUpdatedAt: timestamp("scoreUpdatedAt"),

  // ── XP ENGINE — QUALITATIVE SCORES (admin-set, subject to decay) ─────────
  // C4: Content Quality (0–10, admin-scored per review cycle)
  c4ContentQuality: float("c4ContentQuality").default(0).notNull(),
  c4UpdatedAt: timestamp("c4UpdatedAt"),
  // C6: Community Value (0–10, admin-scored)
  c6CommunityValue: float("c6CommunityValue").default(0).notNull(),
  c6UpdatedAt: timestamp("c6UpdatedAt"),
  // C7: Builder Output (0–10, set on builder submission approval)
  c7BuilderOutput: float("c7BuilderOutput").default(0).notNull(),
  c7UpdatedAt: timestamp("c7UpdatedAt"),
  // C8: Builder Depth (0–10, admin-scored on submission review)
  c8BuilderDepth: float("c8BuilderDepth").default(0).notNull(),
  c8UpdatedAt: timestamp("c8UpdatedAt"),
  // C9: Engagement Authenticity (0–10, admin-scored)
  c9EngagementAuth: float("c9EngagementAuth").default(0).notNull(),
  c9UpdatedAt: timestamp("c9UpdatedAt"),
  // C10: Mission Alignment (0–10, admin-scored)
  c10MissionAlign: float("c10MissionAlign").default(0).notNull(),
  c10UpdatedAt: timestamp("c10UpdatedAt"),

  // ── XP ENGINE — CACHED COMPONENT SCORES ──────────────────────────────────
  // Each xpCN stores the last-calculated weighted contribution of that component
  xpC1: float("xpC1").default(0).notNull(),   // Post Frequency (auto)
  xpC2: float("xpC2").default(0).notNull(),   // Posting Consistency (auto)
  xpC3: float("xpC3").default(0).notNull(),   // Engagement Reach (auto, primary+bonus)
  xpC3Bonus: float("xpC3Bonus").default(0).notNull(), // C3 bonus only — engagement RECEIVED (0–6, for viral_voice badge)
  xpC4: float("xpC4").default(0).notNull(),   // Content Quality (admin, decays)
  xpC5: float("xpC5").default(0).notNull(),   // TG Participation (auto)
  xpC6: float("xpC6").default(0).notNull(),   // Community Value (admin, decays)
  xpC7: float("xpC7").default(0).notNull(),   // Builder Output (auto)
  xpC8: float("xpC8").default(0).notNull(),   // Builder Depth (admin, decays)
  xpC9: float("xpC9").default(0).notNull(),   // Engagement Auth (admin, decays)
  xpC10: float("xpC10").default(0).notNull(), // Mission Alignment (admin, decays)
  xpC11: float("xpC11").default(0).notNull(), // Test Score (static)
  // Total XP (0–100, sum of all components, cached)
  totalXP: float("totalXP").default(0).notNull(),
  // XP snapshot history: [{date: "2026-03-17", xp: 42.5}, ...]
  xpSnapshotHistory: json("xpSnapshotHistory"),
  // XP trend: -1=falling, 0=stable, 1=rising
  xpTrend: int("xpTrend").default(0).notNull(),
  // Last full XP recalculation timestamp
  xpUpdatedAt: timestamp("xpUpdatedAt"),

  // ── EVANGELIST MONITORING ─────────────────────────────────────────────────
  // Number of consecutive days C1+C2 XP has been below 15 (warning threshold)
  evangelistConsistencyDaysBelow: int("evangelistConsistencyDaysBelow").default(0).notNull(),
  // When the 14-day strip countdown started (null = not in warning)
  evangelistWarningStartedAt: timestamp("evangelistWarningStartedAt"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // Avatar URL (uploaded or generated)  
  avatarUrl: text("avatarUrl"),
  // Public display handle (defaults to twitterHandle)
  displayHandle: varchar("displayHandle", { length: 255 }),
  // Wallet address for stablecoin rewards
  walletAddress: varchar("walletAddress", { length: 255 }),
  // Telegram OpenID that has claimed this application (tg:<userId>) — set during claim flow
  claimedByTgOpenId: varchar("claimedByTgOpenId", { length: 128 }),
  // Timestamp of the last time this ambassador's X handle was scraped (updated on every scrape run)
  lastScrapedAt: timestamp("lastScrapedAt"),
  // ── AI Studio (operator-holds-keys) ──
  // Per-ambassador LiteLLM virtual key. Server-only, never sent to client.
  litellmKey: varchar("litellm_key", { length: 256 }),
  litellmKeyIssuedAt: timestamp("litellm_key_issued_at"),
  // Legacy denormalized AI tier (none/starter/active/elite). Superseded by
  // xpTier; retained to avoid a destructive migration. No longer read.
  aiTier: mysqlEnum("ai_tier", ["none", "starter", "active", "elite"])
    .default("none")
    .notNull(),

  // ── XP v2.0 — UNLIMITED LIFETIME ACCUMULATION ─────────────────────────────
  // Unlimited accumulating balance. totalXP (0–100) is the daily earn rate;
  // this grows by floor((totalXP/100)^0.8 * 50) each cron run. NEVER decrements.
  lifetimeXp: bigint("lifetime_xp", { mode: "number", unsigned: true })
    .default(0)
    .notNull(),
  // Denormalized tier derived from lifetimeXp (synced by the XP recalc loop).
  xpTier: mysqlEnum("xp_tier", ["starter", "active", "champion", "elite"])
    .default("starter")
    .notNull(),
  // Permanent founding-cohort flag. Set once at Solitaire closure, never unset.
  isSolitaire: int("is_solitaire").default(0).notNull(),
  // Admin-set fraud flag: locks tier to starter, zeroes earn, excludes Solitaire.
  fraudFlag: int("fraud_flag").default(0).notNull(),
  // Set when a Telegram user claims this application; cleared by admin
  // confirmation. While 1, no AI/tier benefits apply.
  claimPending: int("claim_pending").default(0).notNull(),
  // Account age in days, recomputed by the cron (not a MySQL generated column —
  // Drizzle generated-column support is unreliable).
  accountAgeDays: int("account_age_days"),

  // ── BUILD BIBLE v1.2 — PER-ACTION LEDGER MODEL ────────────────────────────
  // lifetime_xp (above) is now the cached SUM(xp_events.xp_amount). xp_30day
  // is the leaderboard "active now" sort; xp_90day drives tier requalification.
  // All three are caches recomputed by the daily cron; xp_events is the truth.
  xp30day: int("xp_30day", { unsigned: true }).default(0).notNull(),
  xp90day: int("xp_90day", { unsigned: true }).default(0).notNull(),
  // Requalifying AI tier (Bible Part 6). Replaces legacy xp_tier.
  currentTier: mysqlEnum("current_tier", ["initiate", "active", "champion", "elite"])
    .default("initiate")
    .notNull(),
  // Grace deadline for a pending one-band step-down; null if none pending.
  tierStepDownAt: timestamp("tier_step_down_at"),
  // Permanent founding-member designation (Bible Part 8). Set once, never unset.
  isFounding: int("is_founding").default(0).notNull(),
  // Evangelist track (Bible Part 8A). Set/cleared by admin; the cron only
  // tracks the 14-day step-back grace when tier falls below Champion.
  evangelistGrantedAt: timestamp("evangelist_granted_at"),
  evangelistStepBackAt: timestamp("evangelist_step_back_at"),
  // Admin-set flag: exclude this account from the public leaderboard (e.g. team/staff accounts).
  hideFromLeaderboard: int("hide_from_leaderboard").default(0).notNull(),
});
export type AmbassadorApplication =
  typeof ambassadorApplications.$inferSelect;
export type InsertAmbassadorApplication =
  typeof ambassadorApplications.$inferInsert;

// ── AI VIDEO JOBS ────────────────────────────────────────────────────────────
export const aiVideoJobs = mysqlTable("ai_video_jobs", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerJobId: varchar("provider_job_id", { length: 256 }),
  model: varchar("model", { length: 128 }).notNull(),
  prompt: text("prompt").notNull(),
  startFrameUrl: text("start_frame_url"),
  duration: int("duration"),
  resolution: varchar("resolution", { length: 16 }),
  status: mysqlEnum("status", ["queued", "processing", "complete", "failed"])
    .default("queued")
    .notNull(),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiVideoJob = typeof aiVideoJobs.$inferSelect;
export type InsertAiVideoJob = typeof aiVideoJobs.$inferInsert;

// ── PROGRAM CONFIG (key/value, milestone latches) ────────────────────────────
export const programConfig = mysqlTable("program_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("config_key", { length: 128 }).notNull().unique(),
  value: text("value"),
  closedAt: timestamp("closed_at"),
  communityTotalAtClose: bigint("community_total_at_close", { mode: "number" }),
  solitaireCount: int("solitaire_count"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProgramConfig = typeof programConfig.$inferSelect;
export type InsertProgramConfig = typeof programConfig.$inferInsert;

// ── XP EVENT LEDGER (Build Bible v1.2 Part 4.4) ──────────────────────────────
// Append-only. Lifetime XP = SUM(xp_amount). The UNIQUE (event_type,
// source_ref) key is the idempotency guarantee — one award per real action.
// xp_amount is NEGATIVE only for 'gaming_reversal' rows (Part 4.5).
export const xpEvents = mysqlTable(
  "xp_events",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    applicationId: int("application_id").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    xpAmount: int("xp_amount").notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    sourceRef: varchar("source_ref", { length: 256 }),
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (t) => ({
    uqDedupe: uniqueIndex("uq_dedupe").on(t.eventType, t.sourceRef),
    idxAppTime: index("idx_app_time").on(t.applicationId, t.awardedAt),
  }),
);
export type XpEvent = typeof xpEvents.$inferSelect;
export type InsertXpEvent = typeof xpEvents.$inferInsert;

// ── FOUNDING TIER CONFIG (Build Bible v1.2 Part 8.3) ─────────────────────────
// Single-row config + closure latch. closed_at is set once, forever.
export const foundingConfig = mysqlTable("founding_config", {
  id: int("id").primaryKey().default(1),
  collectiveThreshold: bigint("collective_threshold", { mode: "number" })
    .default(5000000)
    .notNull(),
  seatCap: int("seat_cap").default(100).notNull(),
  individualFloor: int("individual_floor").default(2000).notNull(),
  closedAt: timestamp("closed_at"),
  seatsFilled: int("seats_filled").default(0).notNull(),
});
export type FoundingConfig = typeof foundingConfig.$inferSelect;
export type InsertFoundingConfig = typeof foundingConfig.$inferInsert;

// ── JOURNAL ENTRIES ──────────────────────────────────────────────────────────
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  entryType: mysqlEnum("entryType", ["plan", "journal"]).notNull().default("journal"),
  title: varchar("title", { length: 255 }).notNull().default(""),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

// ── X ACTIVITY TRACKER ───────────────────────────────────────────────────────
export const xActivity = mysqlTable("x_activity", {
  id: int("id").autoincrement().primaryKey(),
  // nullable: null means this is a seed post (e.g. official handle) not tied to an ambassador
  applicationId: int("applicationId"),
  tweetId: varchar("tweetId", { length: 64 }).notNull().unique(),
  // Type: original post, reply, quote, retweet
  tweetType: mysqlEnum("tweetType", ["post", "reply", "quote", "retweet"]).notNull().default("post"),
  text: text("text").notNull(),
  // Engagement metrics at time of scrape
  likes: int("likes").default(0).notNull(),
  retweets: int("retweets").default(0).notNull(),
  replies: int("replies").default(0).notNull(),
  quotes: int("quotes").default(0).notNull(),
  bookmarks: int("bookmarks").default(0).notNull(),
  // Which pipeline stored this row: 'outbound' | 'inbound_official' | 'inbound_mention'
  pipeline: varchar("pipeline", { length: 32 }).default("outbound").notNull(),
  // For quotes/retweets: the original tweet author handle
  quotedFrom: varchar("quotedFrom", { length: 255 }),
  // URL to the tweet
  tweetUrl: text("tweetUrl"),
  // When the tweet was posted
  postedAt: timestamp("postedAt").notNull(),
  // When we scraped it
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
});
export type XActivity = typeof xActivity.$inferSelect;
export type InsertXActivity = typeof xActivity.$inferInsert;

// ── X SCRAPE RUNS ─────────────────────────────────────────────────────────────
export const xScrapeRuns = mysqlTable("x_scrape_runs", {
  id: int("id").autoincrement().primaryKey(),
  // null = full run for all ambassadors, non-null = single ambassador run
  applicationId: int("applicationId"),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
  tweetCount: int("tweetCount").default(0).notNull(),
  errorMessage: text("errorMessage"),
  // Spec version this run was executed against (SCRAPING_SPEC_VERSION)
  specVersion: varchar("specVersion", { length: 16 }).default("6.0").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type XScrapeRun = typeof xScrapeRuns.$inferSelect;
export type InsertXScrapeRun = typeof xScrapeRuns.$inferInsert;

// ── TELEGRAM ACTIVITY TRACKER ────────────────────────────────────────────
export const telegramActivity = mysqlTable("telegram_activity", {
  id: int("id").autoincrement().primaryKey(),
  // Matched ambassador application ID (null if handle not matched)
  applicationId: int("applicationId"),
  // Telegram handle from the chat export
  telegramHandle: varchar("telegramHandle", { length: 255 }).notNull(),
  // Message ID from Telegram export (unique — prevents double-counting on re-upload)
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  // Message text content
  text: text("text").notNull(),
  // Message type: message, reply, forward
  messageType: mysqlEnum("messageType", ["message", "reply", "forward"]).notNull().default("message"),
  // If this is a reply, the ID of the message being replied to
  replyToId: varchar("replyToId", { length: 64 }),
  // When the message was sent
  sentAt: timestamp("sentAt").notNull(),
  // Which upload batch this came from
  uploadBatchId: varchar("uploadBatchId", { length: 64 }).notNull(),
  // When we parsed it
  parsedAt: timestamp("parsedAt").defaultNow().notNull(),
});
export type TelegramActivity = typeof telegramActivity.$inferSelect;
export type InsertTelegramActivity = typeof telegramActivity.$inferInsert;

// ── TELEGRAM UPLOAD BATCHES ───────────────────────────────────────────────
export const telegramBatches = mysqlTable("telegram_batches", {
  id: varchar("id", { length: 64 }).primaryKey(), // UUID
  filename: varchar("filename", { length: 255 }).notNull(),
  messageCount: int("messageCount").default(0).notNull(),
  matchedCount: int("matchedCount").default(0).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type TelegramBatch = typeof telegramBatches.$inferSelect;

// ── FEATURED POSTS ────────────────────────────────────────────────────────────
// Admin-curated featured posts per ambassador, shown on leaderboard/profile
export const featuredPosts = mysqlTable("featured_posts", {
  id: int("id").autoincrement().primaryKey(),
  // Which ambassador this post belongs to
  applicationId: int("applicationId").notNull(),
  // Tweet URL (e.g. https://x.com/handle/status/123)
  tweetUrl: text("tweetUrl").notNull(),
  // Tweet text / caption (admin can override or leave blank to use scraped text)
  caption: text("caption"),
  // Display position (1 = top, higher = lower)
  position: int("position").default(1).notNull(),
  // Admin qualitative note about why this post is featured
  adminNote: text("adminNote"),
  // Whether this post is currently visible on the public leaderboard
  isVisible: int("isVisible").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FeaturedPost = typeof featuredPosts.$inferSelect;
export type InsertFeaturedPost = typeof featuredPosts.$inferInsert;

// ── BUILDER SUBMISSIONS ───────────────────────────────────────────────────────
// Ambassadors submit links to integrations, articles, events etc. for C7/C8 XP
export const builderSubmissions = mysqlTable("builder_submissions", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  url: text("url").notNull(),
  submissionType: mysqlEnum("submissionType", [
    "integration", "repository", "article", "tutorial",
    "event", "introduction", "translation", "bug_report", "other"
  ]).notNull().default("other"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  xpAwarded: float("xpAwarded").default(0),
  adminNote: text("adminNote"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});
export type BuilderSubmission = typeof builderSubmissions.$inferSelect;
export type InsertBuilderSubmission = typeof builderSubmissions.$inferInsert;

// ── AMBASSADOR BADGES ─────────────────────────────────────────────────────────
// Tracks per-ambassador badge status (active / dormant / locked)
export const ambassadorBadges = mysqlTable("ambassador_badges", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  // Badge key from shared/badges.ts (e.g. "evangelist", "wordsmith")
  badgeKey: varchar("badgeKey", { length: 64 }).notNull(),
  // active = earned and above threshold; dormant = below threshold but in grace; locked = never earned
  status: mysqlEnum("status", ["active", "dormant", "locked"]).notNull().default("locked"),
  // When the badge was first awarded
  awardedAt: timestamp("awardedAt"),
  // When the badge went dormant (null if active or locked)
  dormantAt: timestamp("dormantAt"),
  // End of 14-day grace window (null if not in grace period)
  graceWindowEnd: timestamp("graceWindowEnd"),
  // Score at time of last status change
  scoreAtChange: float("scoreAtChange"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AmbassadorBadge = typeof ambassadorBadges.$inferSelect;
export type InsertAmbassadorBadge = typeof ambassadorBadges.$inferInsert;

// ── BADGE EVENTS LOG ──────────────────────────────────────────────────────────
// Immutable audit log of every badge state change
export const badgeEvents = mysqlTable("badge_events", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  badgeKey: varchar("badgeKey", { length: 64 }).notNull(),
  // awarded / dormant / reactivated / override_active / override_dormant
  eventType: mysqlEnum("eventType", ["awarded", "dormant", "reactivated", "override_active", "override_dormant"]).notNull(),
  scoreAtEvent: float("scoreAtEvent"),
  // Admin user ID if this was a manual override
  adminId: int("adminId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BadgeEvent = typeof badgeEvents.$inferSelect;

// ── OFFICIAL UPDATES ─────────────────────────────────────────────────────────
// Posts from official handles — displayed in leaderboard "Official" feed
export const officialUpdates = mysqlTable("official_updates", {
  id: int("id").autoincrement().primaryKey(),
  // Source account: official handle or secondary handle
  source: varchar("source", { length: 64 }).notNull().default("official"),
  // Tweet ID (unique)
  tweetId: varchar("tweetId", { length: 64 }).notNull().unique(),
  // Short display title (optional, admin-set or auto-extracted)
  title: varchar("title", { length: 500 }),
  // Full tweet text
  content: text("content"),
  // When the tweet was published
  publishedAt: timestamp("publishedAt").notNull(),
  // URL to the tweet
  tweetUrl: text("tweetUrl"),
  // Whether this post is visible in the public leaderboard feed
  isVisible: int("isVisible").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OfficialUpdate = typeof officialUpdates.$inferSelect;
export type InsertOfficialUpdate = typeof officialUpdates.$inferInsert;

// ── PERKS HIDDEN PRODUCTS ────────────────────────────────────────────────────
export const perksHiddenProducts = mysqlTable("perks_hidden_products", {
  productId: varchar("product_id", { length: 64 }).primaryKey(),
  hiddenAt: bigint("hidden_at", { mode: "number" }).notNull(),
  hiddenBy: varchar("hidden_by", { length: 255 }).notNull(),
});
export type PerksHiddenProduct = typeof perksHiddenProducts.$inferSelect;


// ── PERKS FEATURED PRODUCTS ──────────────────────────────────────────────────
export const perksFeaturedProducts = mysqlTable("perks_featured_products", {
  productId: varchar("product_id", { length: 64 }).primaryKey(),
  featuredAt: bigint("featured_at", { mode: "number" }).notNull(),
  featuredBy: varchar("featured_by", { length: 255 }).notNull(),
});
export type PerksFeaturedProduct = typeof perksFeaturedProducts.$inferSelect;

// ── PERKS PRODUCT CATALOG CACHE ─────────────────────────────────────────────
// Persists the full NachoNacho catalog to DB so it survives server restarts
export const perksProductCache = mysqlTable("perks_product_cache", {
  id: int("id").primaryKey().autoincrement(),
  cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  data: mediumtext("data").notNull(), // JSON array of NNProduct[] — needs MEDIUMTEXT for 900+ products
});
export type PerksProductCache = typeof perksProductCache.$inferSelect;

// ── AI STUDIO v5 ─────────────────────────────────────────────────────────────
// Model registry — 180 curated models from the v5 workbook (15 per tier × 3 modalities × 4 tiers)
// Tier is the MINIMUM tier required to access the model; higher tiers see all lower-tier models too.
export const aiModels = mysqlTable("ai_models", {
  id: int("id").primaryKey().autoincrement(),
  tier: varchar("tier", { length: 16 }).notNull(), // initiate | active | champion | elite
  modality: varchar("modality", { length: 8 }).notNull(), // text | image | video
  name: varchar("name", { length: 128 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(), // OpenRouter | fal.ai
  pricePerUnit: float("price_per_unit").notNull(), // $/gen, $/image, or $/sec
  priceBasis: varchar("price_basis", { length: 32 }).notNull(), // $/gen 500+500 tok | per image | per second
  why: varchar("why", { length: 255 }).notNull().default(""),
  // Internal routing identifier (OpenRouter model slug or fal.ai endpoint path)
  routingId: varchar("routing_id", { length: 255 }).notNull().default(""),
  isActive: int("is_active").notNull().default(1),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = typeof aiModels.$inferInsert;

// Generation log — one row per generation request
export const aiGenerationLog = mysqlTable("ai_generation_log", {
  id: int("id").primaryKey().autoincrement(),
  applicationId: int("application_id").notNull(),
  modelId: int("model_id").notNull(),
  modality: varchar("modality", { length: 8 }).notNull(), // text | image | video
  provider: varchar("provider", { length: 32 }).notNull(),
  prompt: text("prompt").notNull(),
  outputUrl: text("output_url"),
  outputText: text("output_text"),
  videoSeconds: float("video_seconds"),
  costUsd: float("cost_usd").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | success | error
  errorMessage: text("error_message"),
  // Async fal.ai job tracking: stored when job is submitted, cleared on completion
  falRequestId: varchar("fal_request_id", { length: 128 }),
  falEndpoint: varchar("fal_endpoint", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
});
export type AiGenerationLog = typeof aiGenerationLog.$inferSelect;

// Monthly video-second spend — one row per (applicationId, year, month)
export const aiVideoSpend = mysqlTable("ai_video_spend", {
  id: int("id").primaryKey().autoincrement(),
  applicationId: int("application_id").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1–12
  secondsUsed: float("seconds_used").notNull().default(0),
  capSeconds: int("cap_seconds").notNull(), // initiate=220, active=330, champion=550, elite=880
  alert80Sent: int("alert_80_sent").notNull().default(0),
  alert95Sent: int("alert_95_sent").notNull().default(0),
  alert100Sent: int("alert_100_sent").notNull().default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type AiVideoSpend = typeof aiVideoSpend.$inferSelect;

// N2: Monthly dollar-spend cap per (applicationId, year, month, modality).
// Covers text + image generation; video keeps its own per-second table for
// cap alerts. Reservation logic in `server/ai/generate.ts` increments
// `dollars_used` atomically before the upstream request and refunds on
// failure.
export const aiSpendMonth = mysqlTable("ai_spend_month", {
  id: int("id").primaryKey().autoincrement(),
  applicationId: int("application_id").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  modality: varchar("modality", { length: 8 }).notNull(), // text | image
  dollarsUsed: float("dollars_used").notNull().default(0),
  dollarsCap: float("dollars_cap").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type AiSpendMonth = typeof aiSpendMonth.$inferSelect;

// AI Studio first-use verification — one row per contributor
export const studioVerifications = mysqlTable("studio_verifications", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  xHandle: varchar("x_handle", { length: 100 }).notNull(),
  telegramHandle: varchar("telegram_handle", { length: 100 }).notNull(),
  // Link to ambassador application if found by email
  applicationId: int("application_id"),
  status: mysqlEnum("status", ["pending", "verified", "rejected"]).notNull().default("pending"),
  submittedAt: bigint("submitted_at", { mode: "number" }).notNull(),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  notes: text("notes"),
});
export type StudioVerification = typeof studioVerifications.$inferSelect;
