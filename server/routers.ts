import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { fetchNachoNachoProducts, buildFullCatalogInBackground, getCatalogStatus } from "./nachonacho";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { assertOwnsApplication } from "./_core/auth";
import { enforcePublicRateLimit } from "./_core/publicRateLimit";
import { aiRouter } from "./aiRouter";
import { aiStudioRouter } from "./ai/aiStudioRouter";
import {
  createApplication,
  checkEmailForApplication,
  updateApplicationProgress,
  listApplications,
  getApplicationById,
  scrubAmbassador,
  updateApplicationStatus,
  getApplicationStats,
  updateApplicationScores,
  getRankedLeaderboard,
  getPublicLeaderboard,
  getPublicProfile,
  getApplicationByEmail,
  getJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getAllFeaturedPosts,
  getFeaturedPostsByAmbassador,
  upsertFeaturedPost,
  deleteFeaturedPost,
  reorderFeaturedPosts,
  getAmbassadorByHandle,
  getRankContext,
  updateWalletAddress,
  getBuilderSubmissions,
  createBuilderSubmission,
  deleteBuilderSubmission,
  getAllBuilderSubmissions,
} from "./db";
import { notifyOwner } from "./_core/notification";
import {
  parseTelegramHtml,
  storeTelegramBatch,
  mapTelegramSenderToAmbassador,
  rematchNullRows,
} from "./telegramParser";
import {
  getTelegramBatches,
  getTelegramUnmatchedSenders,
  getTelegramActivitySummary,
  getTelegramMappingStatus,
  getXMappingStatus,
} from "./db";
import {
  scrapeAmbassadorX,
  scrapeAllAmbassadorsX,
  getScrapeJob,
  getXActivitySummary,
  getAmbassadorXActivity,
  backfillAvatarUrls,
  scrapeOfficialEngagement,
  scrapeConversationThreads,
} from "./xScraper";
import {
  startScrapeJob,
  getScrapeJobStatus,
  getLastCompletedJob,
  getCurrentRunningJob,
} from "./apifyPipeline";
import {
  recalculateAllXP,
  recalculateXPForAmbassador,
  calculateTotalXP,
  addXPSnapshot,
  COMPONENT_MAX,
  TOTAL_MAX_XP,
} from "./xpEngine";
import {
  computeBadgesForAmbassador,
  getActiveBadgeKeys,
  getAllBadgeRows,
} from "./badgeEngine";
import { ambassadorBadges, badgeEvents, perksHiddenProducts, perksFeaturedProducts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";

// ── ADMIN GUARD ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ── APPLICATION SCHEMA ───────────────────────────────────────────────────────
// Normalise a community link URL — prepend https:// if the user forgot the protocol.
function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Already has a protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Handle t.me/x shorthand
  if (/^t\.me\//i.test(trimmed)) return `https://${trimmed}`;
  // Handle @handle — not a URL, return as-is so Zod rejects it with a clear message
  if (/^@/.test(trimmed)) return trimmed;
  // Everything else: prepend https://
  return `https://${trimmed}`;
}

const communityLinkSchema = z.object({
  url: z.string().min(1, "Please enter a link for this community (e.g. t.me/yourgroup or discord.gg/abc).").transform(normaliseUrl).pipe(
    z.string().url("That doesn't look like a valid link. Try something like t.me/yourgroup, discord.gg/abc, or twitter.com/yourcommunity.")
  ),
  description: z.string().min(1, "Please add a short description for this community link — what it is and roughly how many people are in it."),
});

const submitSchema = z.object({
  email: z.string().email(),
  isEvangelist: z.boolean().optional(),
  tracks: z.array(z.enum(["community", "developer", "content"])).min(1),
  contributionIntent: z.array(z.string()).min(1),
  testScore: z.number().int().min(0).max(10),
  communities: z
    .string()
    .refine(
      (s) => s.length === 0 || s.length >= 15,
      "Please describe your communities in at least a sentence, or leave it blank."
    )
    .optional()
    .default(""),
  twitterHandle: z.string().max(255).optional(),
  telegramHandle: z.string().max(255).optional(),
  githubHandle: z.string().max(255).optional(),
  otherLinks: z.string().optional(),
  hasCommunityExperience: z.enum(["yes", "no"]),
  communityLinks: z.array(communityLinkSchema).optional(),
  protocolDescription: z.string().min(15, "Please describe the protocol in your own words — at least one sentence."),
  communityBenefit: z.string().min(40, "Please tell us why you want to be an Ambassador. Write at least a few sentences — be specific about what draws you to the program and what you'd contribute."),
  firstThirtyDays: z.string().min(50, "Please describe what you would do in your first 30 days. Be specific — mention concrete actions, platforms, and communities you'd engage with."),
});

export const appRouter = router({
  system: systemRouter,

  ai: aiRouter,
  aiStudio: aiStudioRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  ambassador: router({
    // Public: check email — returns existing record info or null
    checkEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const existing = await checkEmailForApplication(input.email.toLowerCase().trim());
        if (!existing) return { exists: false, isEvangelist: false, lastStep: null, id: null, level: 0, status: 'pending' as const, twitterHandle: null, telegramHandle: null, communityBenefit: null };
        return {
          exists: true,
          isEvangelist: existing.isEvangelist === 1,
          lastStep: existing.lastStep,
          id: existing.id,
          level: existing.level ?? 0,
          status: existing.status ?? 'pending',
          twitterHandle: existing.twitterHandle ?? null,
          telegramHandle: existing.telegramHandle ?? null,
          communityBenefit: existing.communityBenefit ?? null,
        };
      }),

    // Public: update progress step for an in-progress application.
    // S5: IP-rate-limited (60/hr per IP) and lastStep length-bounded so a
    // bot can't flood arbitrary strings into the column.
    updateProgress: publicProcedure
      .input(z.object({ id: z.number().int().positive(), lastStep: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        enforcePublicRateLimit(ctx.req, "ambassador.updateProgress", 60);
        await updateApplicationProgress(input.id, input.lastStep);
        return { success: true };
      }),

    // Public: submit an application.
    // S5: IP-rate-limited and auto-admit now requires a passing knowledge
    // score (>= MIN_AUTO_ADMIT_SCORE) instead of any non-zero score.
    submit: publicProcedure
      .input(submitSchema)
      .mutation(async ({ ctx, input }) => {
        enforcePublicRateLimit(ctx.req, "ambassador.submit", 10);
        // Sanitize social handles: strip full URLs, leading @, and whitespace
        const sanitizeXHandle = (raw: string | undefined | null): string | null => {
          if (!raw) return null;
          const cleaned = raw
            .trim()
            .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "") // strip x.com/twitter.com URLs
            .replace(/^@+/, "") // strip leading @
            .trim();
          return cleaned || null;
        };
        const cleanTwitterHandle = sanitizeXHandle(input.twitterHandle);
        const cleanTelegramHandle = input.telegramHandle?.trim() || null;
        // Check if application already exists for this email
        const existing = await checkEmailForApplication(input.email.toLowerCase().trim());
        let id: number;
        // S5: auto-admit only with a passing score (6/10). Below the bar,
        // the application stays at L0 pending review.
        const MIN_AUTO_ADMIT_SCORE = 6;
        const autoLevel = input.testScore >= MIN_AUTO_ADMIT_SCORE ? 1 : 0;
        if (existing) {
          // Update existing record to submitted state and promote level if needed
          await updateApplicationProgress(existing.id, "submitted");
          if (autoLevel > (existing.level ?? 0)) {
            await updateApplicationScores(existing.id, { level: autoLevel });
            const { getApplicationById: _getApp } = await import("./db");
            const { syncAiAccess } = await import("./ai/syncAiAccess");
            const fresh = await _getApp(existing.id);
            if (fresh) {
              await syncAiAccess({
                id: fresh.id,
                level: fresh.level,
                currentTier: fresh.currentTier,
                claimPending: fresh.claimPending,
                fraudFlag: fresh.fraudFlag,
                twitterHandle: fresh.twitterHandle,
                litellmKey: fresh.litellmKey,
              });
            }
          }
          id = existing.id;
        } else {
          id = await createApplication({
            email: input.email.toLowerCase().trim(),
            isEvangelist: input.isEvangelist ? 1 : 0,
            lastStep: "submitted",
            level: autoLevel,
            tracks: input.tracks,
            contributionIntent: input.contributionIntent,
            testScore: input.testScore,
            communities: input.communities,
            twitterHandle: cleanTwitterHandle,
            telegramHandle: cleanTelegramHandle,
            githubHandle: input.githubHandle ?? null,
            otherLinks: input.otherLinks ?? null,
            hasCommunityExperience: input.hasCommunityExperience,
            communityLinks: input.communityLinks ?? null,
            protocolDescription: input.protocolDescription,
            communityBenefit: input.communityBenefit,
            firstThirtyDays: input.firstThirtyDays,
            status: "pending",
          });
        }

        // Notify owner of new application
        await notifyOwner({
          title: `New Ambassador Application — ${(input.tracks as string[]).join(", ").toUpperCase()}`,
          content: `New application for tracks: ${(input.tracks as string[]).join(", ")}.\n\nTest score: ${input.testScore}/10\n\nFirst 30 days: ${input.firstThirtyDays.slice(0, 200)}...`,
        }).catch(() => {}); // non-blocking

        return { success: true, id };
      }),

    // Public: get aggregate stats
    stats: publicProcedure.query(async () => {
      return getApplicationStats();
    }),

    // Admin: list all applications
    list: adminProcedure
      .input(
        z.object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        const apps = await listApplications(input ?? {});
        // Build a stable sequential rowNum map: sort all IDs ascending, assign 1-based positions
        const { asc } = await import('drizzle-orm');
        const { ambassadorApplications: appTable } = await import('../drizzle/schema');
        const db = await getDb();
        const allIds = db
          ? (await db.select({ id: appTable.id }).from(appTable).orderBy(asc(appTable.id))).map(r => r.id)
          : [];
        const rowNumMap = new Map(allIds.map((id, idx) => [id, idx + 1]));
        // lastScrapedAt comes directly from the ambassador record (stamped after every scrape run)
        return apps.map(app => ({ ...app, rowNum: rowNumMap.get(app.id) ?? app.id, lastScrapedAt: (app as any).lastScrapedAt ?? null }));
      }),

    // Admin: get single application detail
    getById: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const app = await getApplicationById(input.id);
        if (!app) throw new TRPCError({ code: "NOT_FOUND" });
        return scrubAmbassador(app);
      }),

    // Admin: update application status
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["pending", "approved", "rejected"]),
          adminNotes: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateApplicationStatus(input.id, input.status, input.adminNotes);
        // When approving, immediately recalculate XP from existing DB data
        // (no scrape — just re-runs the XP formula against what is already stored)
        if (input.status === "approved") {
          try {
            await recalculateXPForAmbassador(input.id);
          } catch (err) {
            console.error(`[XP] Auto-recalc on approval failed for id=${input.id}:`, err);
            // Non-fatal — status update already succeeded
          }
        }
        return { success: true };
      }),

    // Admin: update scoring signals for an applicant
    updateScores: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          xContentScore: z.number().min(0).max(10).optional(),
          xEngagementScore: z.number().min(0).max(10).optional(),
          xConsistencyScore: z.number().min(0).max(10).optional(),
          communityContribScore: z.number().min(0).max(10).optional(),
          tgActivityScore: z.number().min(0).max(20).optional(),
          adminOverrideScore: z.number().min(-10).max(10).optional(),
          level: z.number().int().min(0).max(5).optional(),
          evangelistCandidate: z.number().int().min(0).max(1).optional(),
          fraudFlag: z.number().int().min(0).max(1).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...scores } = input;
        await updateApplicationScores(id, scores);
        // Recalculate XP immediately so leaderboard reflects the new scores
        await recalculateXPForAmbassador(id);
        return { success: true };
      }),

    // Admin: confirm a pending Telegram claim (unlocks AI/tier benefits)
    confirmClaim: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { confirmClaim } = await import("./db");
        await confirmClaim(input.id);
        return { success: true };
      }),

    // Build Bible v1.2 Part 8A — Evangelist is a curated, hand-picked
    // honour: 12 seats, admin-granted (the cron only tracks step-back).
    setEvangelist: adminProcedure
      .input(z.object({ id: z.number().int().positive(), grant: z.boolean() }))
      .mutation(async ({ input }) => {
        const { drizzle } = await import("drizzle-orm/mysql2");
        const { ambassadorApplications } = await import("../drizzle/schema");
        const { eq, sql } = await import("drizzle-orm");
        const db = drizzle(process.env.DATABASE_URL!);
        if (input.grant) {
          const [{ filled }] = await db
            .select({ filled: sql<number>`COUNT(*)` })
            .from(ambassadorApplications)
            .where(eq(ambassadorApplications.isEvangelist, 1));
          if (Number(filled ?? 0) >= 12) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "All 12 Evangelist seats are filled.",
            });
          }
          await db
            .update(ambassadorApplications)
            .set({
              isEvangelist: 1,
              evangelistGrantedAt: new Date(),
              evangelistStepBackAt: null,
            })
            .where(eq(ambassadorApplications.id, input.id));
        } else {
          await db
            .update(ambassadorApplications)
            .set({
              isEvangelist: 0,
              evangelistGrantedAt: null,
              evangelistStepBackAt: null,
            })
            .where(eq(ambassadorApplications.id, input.id));
        }
        return { success: true };
      }),

    // Build Bible v1.2 Part 4.3 — weekly community-referral sweep.
    referralSweep: adminProcedure
      .input(
        z.object({
          entries: z
            .array(
              z.object({
                referralCode: z.string().min(1).max(64),
                joiner: z.string().min(1).max(128),
              }),
            )
            .max(2000),
        }),
      )
      .mutation(async ({ input }) => {
        const { runReferralSweep } = await import("./referral");
        return runReferralSweep(input.entries);
      }),

    // Build Bible v1.2 Step 4 — run the one-time freeze-and-carry migration
    // (idempotent; safe to re-run). Then verify.
    migrateLedger: adminProcedure.mutation(async () => {
      const { runOpeningBalanceMigration } = await import("./migrateToLedger");
      return runOpeningBalanceMigration();
    }),
    verifyLedgerMigration: adminProcedure.query(async () => {
      const { verifyMigration } = await import("./migrateToLedger");
      const mismatches = await verifyMigration();
      return { ok: mismatches.length === 0, mismatches };
    }),
    // Build Bible v1.2 Step 5 — run the daily ledger cron on demand.
    runLedgerCron: adminProcedure.mutation(async () => {
      const { runLedgerDailyCron } = await import("./ledgerCron");
      return runLedgerDailyCron();
    }),
     // Admin: get ranked leaderboard
    leaderboard: adminProcedure
      .input(z.object({ evangelistMode: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return getRankedLeaderboard(input?.evangelistMode ?? false);
      }),
    // Public: leaderboard (approved applicants only, limited fields)
    publicLeaderboard: publicProcedure.query(async () => {
      return getPublicLeaderboard();
    }),
    // Public: community lifetime-XP progress toward the Solitaire threshold
    communityProgress: publicProcedure.query(async () => {
      const { getCommunityXpProgress } = await import("./db");
      return getCommunityXpProgress();
    }),
    // Public: single profile by id
    publicProfile: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const profile = await getPublicProfile(input.id);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
        return profile;
      }),
    // Protected: get own application (by logged-in user email)
    myApplication: protectedProcedure.query(async ({ ctx }) => {
      // For Telegram-logged-in users (openId starts with 'tg:'), match by:
      // 1. claimedByTgOpenId (permanent link set after claim flow)
      // 2. telegramHandle fuzzy match (legacy)
      if (ctx.user.openId?.startsWith('tg:')) {
        const { getApplicationByClaimedTgOpenId, getApplicationByTelegramHandle } = await import('./db');
        // 1. Check permanent claim link first
        const claimed = await getApplicationByClaimedTgOpenId(ctx.user.openId);
        if (claimed) return scrubAmbassador(claimed);
        // 2. Fall back to telegramHandle fuzzy match
        const tgUsername = ctx.user.name;
        if (tgUsername) {
          const app = await getApplicationByTelegramHandle(tgUsername);
          if (app) return scrubAmbassador(app);
        }
        return null;
      }
      const email = ctx.user.email;
      if (!email) return null;
      const byEmail = await getApplicationByEmail(email);
      return byEmail ? scrubAmbassador(byEmail) : null;
    }),

    // Protected: claim an application by X/Twitter handle (step 2 of claim flow)
    claimByXHandle: protectedProcedure
      .input(z.object({ xHandle: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.openId?.startsWith('tg:')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only Telegram users can use this flow' });
        }
        const { getApplicationByTwitterHandleClaim, claimApplicationByTgOpenId, getApplicationByClaimedTgOpenId } = await import('./db');
        // Prevent double-claiming
        const alreadyClaimed = await getApplicationByClaimedTgOpenId(ctx.user.openId);
        if (alreadyClaimed) return { success: true, applicationId: alreadyClaimed.id };
        const app = await getApplicationByTwitterHandleClaim(input.xHandle);
        if (!app) return { success: false, applicationId: null };
        // Check not already claimed by someone else
        if (app.claimedByTgOpenId && app.claimedByTgOpenId !== ctx.user.openId) {
          throw new TRPCError({ code: 'CONFLICT', message: 'This application has already been claimed by another account' });
        }
        await claimApplicationByTgOpenId(app.id, ctx.user.openId);
        return { success: true, applicationId: app.id };
      }),

    // Protected: claim an application by picking from the unclaimed list (fallback step 3)
    claimById: protectedProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.openId?.startsWith('tg:')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only Telegram users can use this flow' });
        }
        const { getApplicationById: getAppById, claimApplicationByTgOpenId, getApplicationByClaimedTgOpenId } = await import('./db');
        const alreadyClaimed = await getApplicationByClaimedTgOpenId(ctx.user.openId);
        if (alreadyClaimed) return { success: true, applicationId: alreadyClaimed.id };
        const app = await getAppById(input.applicationId);
        if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
        if (app.claimedByTgOpenId && app.claimedByTgOpenId !== ctx.user.openId) {
          throw new TRPCError({ code: 'CONFLICT', message: 'This application has already been claimed' });
        }
        await claimApplicationByTgOpenId(app.id, ctx.user.openId);
        return { success: true, applicationId: app.id };
      }),

    // Protected: list unclaimed applications (for the pick-from-list fallback UI)
    listUnclaimed: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.openId?.startsWith('tg:')) return [];
      const { listUnclaimedApplications } = await import('./db');
      return listUnclaimedApplications();
    }),

    // Protected: get TG mapping status for own application
    // Returns: { mapped: bool, displayName: string|null, messageCount: number, unmatchedSenders: string[] }
    myTelegramMapping: protectedProcedure.query(async ({ ctx }) => {
      let app = null;
      if (ctx.user.openId?.startsWith('tg:')) {
        const { getApplicationByClaimedTgOpenId, getApplicationByTelegramHandle } = await import('./db');
        app = await getApplicationByClaimedTgOpenId(ctx.user.openId);
        if (!app && ctx.user.name) app = await getApplicationByTelegramHandle(ctx.user.name);
      } else {
        const email = ctx.user.email;
        if (!email) return { mapped: false, displayName: null, messageCount: 0, unmatchedSenders: [] };
        app = await getApplicationByEmail(email);
      }
      if (!app) return { mapped: false, displayName: null, messageCount: 0, unmatchedSenders: [] };
      const { isMapped, displayName, messageCount } = await getTelegramMappingStatus(app.id);
      const unmatchedSenders = await getTelegramUnmatchedSenders();
      return { mapped: isMapped, displayName, messageCount, unmatchedSenders };
    }),

    // Protected: ambassador maps themselves to a Telegram display name
    mapTelegramSelf: protectedProcedure
      .input(z.object({ displayName: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const email = ctx.user.email;
        if (!email) throw new TRPCError({ code: "UNAUTHORIZED" });
        const app = await getApplicationByEmail(email);
        if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "No application found" });
        await mapTelegramSenderToAmbassador(input.displayName, app.id);
        return { success: true };
      }),

    // Protected: get X mapping status for own application
    myXMapping: protectedProcedure.query(async ({ ctx }) => {
      let app = null;
      if (ctx.user.openId?.startsWith('tg:')) {
        const { getApplicationByClaimedTgOpenId, getApplicationByTelegramHandle } = await import('./db');
        app = await getApplicationByClaimedTgOpenId(ctx.user.openId);
        if (!app && ctx.user.name) app = await getApplicationByTelegramHandle(ctx.user.name);
      } else {
        const email = ctx.user.email;
        if (!email) return { mapped: false, twitterHandle: null, tweetCount: 0, lastScrapedAt: null };
        app = await getApplicationByEmail(email);
      }
      if (!app) return { mapped: false, twitterHandle: null, tweetCount: 0, lastScrapedAt: null };
      const { isMapped, tweetCount, lastScrapedAt } = await getXMappingStatus(app.id);
      return { mapped: isMapped, twitterHandle: app.twitterHandle ?? null, tweetCount, lastScrapedAt };
    }),
  }),
  // ── JOURNAL ───────────────────────────────────────────────────────────────
  // S2 fix: every procedure now ownership-checks the caller against the
  // applicationId before reading or mutating journal/plan rows.
  journal: router({
    list: protectedProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        return getJournalEntries(input.applicationId);
      }),
    create: protectedProcedure
      .input(z.object({
        applicationId: z.number().int().positive(),
        entryType: z.enum(["plan", "journal"]),
        title: z.string().max(255),
        content: z.string().max(10000),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        return createJournalEntry(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        applicationId: z.number().int().positive(),
        title: z.string().max(255).optional(),
        content: z.string().max(10000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        const { id, applicationId, ...data } = input;
        await updateJournalEntry(id, applicationId, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        applicationId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        await deleteJournalEntry(input.id, input.applicationId);
        return { success: true };
      }),
  }),

  // ── X TRACKER ──────────────────────────────────────────────────────────────
  xTracker: router({
    // Get activity summary for all ambassadors (admin only)
    getSummary: adminProcedure.query(async () => {
      return getXActivitySummary();
    }),

    // Get detailed activity for a single ambassador (admin only)
    getActivity: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getAmbassadorXActivity(input.applicationId);
      }),

    // Scrape a single ambassador's X activity (admin only)
    scrapeOne: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const result = await scrapeAmbassadorX(input.applicationId);
        return result;
      }),

    // Scrape all ambassadors' X activity (admin only) — fires in background, returns jobId
    // fromDate: optional override start date (YYYY-MM-DD). Pass '2025-03-05' for a full clean scrape from program start.
    scrapeAll: adminProcedure
      .input(z.object({ fromDate: z.string().optional() }))
      .mutation(async ({ input }) => {
        const result = await scrapeAllAmbassadorsX(input.fromDate);
        return result; // { jobId, total }
      }),
    // Poll background scrape-all job status (legacy in-memory)
    getScrapeJobStatus: adminProcedure
      .input(z.object({ jobId: z.string() }))
      .query(({ input }) => {
        const job = getScrapeJob(input.jobId);
        if (!job) return null;
        return job;
      }),
    // ── Scrape All: server-side batch scrape (no webhooks, no URL dependency) ──
    // Runs scrapeAmbassadorX() for all ambassadors directly on the server.
    // Returns immediately with jobId; progress tracked via scrape_jobs table.
    startApifyScrapeJob: adminProcedure
      .input(z.object({ webhookBaseUrl: z.string().url().optional(), fromDate: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { scrapeAllAmbassadorsX } = await import('./xScraper');
        // Fire and forget — runs in background, updates DB as it goes
        // After completion, XP is recalculated automatically inside scrapeAllAmbassadorsX
        const result = await scrapeAllAmbassadorsX(input.fromDate);
        return { jobId: result.jobId, total: result.total, message: 'Scrape started in background' };
      }),
    // Get status of a specific scrape job (DB-backed, survives restarts)
    getApifyScrapeJobStatus: adminProcedure
      .input(z.object({ jobId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getScrapeJobStatus(input.jobId);
      }),
    // Get the last completed scrape job summary
    getLastApifyScrapeJob: adminProcedure.query(async () => {
      return getLastCompletedJob();
    }),
    // Get currently running job (if any)
    getCurrentApifyScrapeJob: adminProcedure.query(async () => {
      return getCurrentRunningJob();
    }),

    // Scrape replies/quotes/reposts on official handles by ambassadors
    scrapeOfficialEngagement: adminProcedure
      .input(z.object({ webhookBaseUrl: z.string().url().optional() }))
      .mutation(async () => {
        // Fire and forget — P2 can take 30-60s; return immediately to avoid proxy 504
        scrapeOfficialEngagement().catch((err) =>
          console.error('[P2] Background scrape failed:', err instanceof Error ? err.message : err)
        );
        return { started: true, message: 'P2 scrape started in background' };
      }),
    // Pipeline 3: scrape conversation threads for ambassador protocol posts
    scrapeConversationThreads: adminProcedure
      .input(z.object({ webhookBaseUrl: z.string().url().optional() }))
      .mutation(async () => {
        // Fire and forget — P3 takes 3-5 minutes; return immediately to avoid 504 proxy timeout
        scrapeConversationThreads().catch((err) =>
          console.error('[P3] Background scrape failed:', err instanceof Error ? err.message : err)
        );
        return { started: true, message: 'P3 scrape started in background' };
      }),

    // Backfill profile photo URLs for all ambassadors (admin only)
    backfillAvatarUrls: adminProcedure.mutation(async () => {
      const result = await backfillAvatarUrls();
      return result; // { updated, failed, skipped }
    }),
  }),

  // ── TELEGRAM TRACKER ───────────────────────────────────────────────────────
  telegram: router({
    // Upload and parse a Telegram HTML export (admin only)
    parseExport: adminProcedure
      .input(z.object({
        htmlContent: z.string().min(1),
        filename: z.string().default("messages.html"),
      }))
      .mutation(async ({ input }) => {
        const messages = parseTelegramHtml(input.htmlContent);
        const result = await storeTelegramBatch(messages, input.filename);
        // Auto-recalculate XP for all ambassadors after upload so new messages immediately reflect in scores
        recalculateAllXP().catch((err) => console.error("[TG] Background XP recalculate failed:", err));
        return result;
      }),

    // Get all upload batches (admin only)
    getBatches: adminProcedure.query(async () => {
      return getTelegramBatches();
    }),

    // Get unmatched senders across all batches (admin only)
    getUnmatchedSenders: adminProcedure.query(async () => {
      return getTelegramUnmatchedSenders();
    }),

    // Re-run auto-matching on all unmatched rows (admin only)
    rematchAll: adminProcedure.mutation(async () => {
      const fixed = await rematchNullRows();
      return { fixed };
    }),

    // Map a display name to an ambassador (admin only)
    mapSender: adminProcedure
      .input(z.object({
        displayName: z.string().min(1),
        applicationId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        await mapTelegramSenderToAmbassador(input.displayName, input.applicationId);
        // Auto-recalculate XP for the mapped ambassador immediately so scores reflect without manual recalculate
        await recalculateXPForAmbassador(input.applicationId);
        return { success: true };
      }),

    // Get activity summary per ambassador (admin only)
    getActivitySummary: adminProcedure.query(async () => {
      return getTelegramActivitySummary();
    }),
  }),

  // ── XP ENGINE ─────────────────────────────────────────────────────────────
  xp: router({
    // Recalculate XP for ALL ambassadors (admin only)
    // Returns count of ambassadors updated
    recalculateAll: adminProcedure.mutation(async () => {
      const count = await recalculateAllXP();
      return { success: true, updated: count };
    }),

    // Get full XP breakdown for a single ambassador (admin only)
    getBreakdown: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const ambassador = await getApplicationById(input.applicationId);
        if (!ambassador) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ambassador not found" });
        }
        const breakdown = await calculateTotalXP(ambassador);
        return {
          ...breakdown,
          componentMax: COMPONENT_MAX,
          totalMax: TOTAL_MAX_XP,
          // Also return the raw admin-set scores for display
          rawScores: {
            c4ContentQuality: ambassador.c4ContentQuality,
            c6CommunityValue: ambassador.c6CommunityValue,
            c7BuilderOutput: ambassador.c7BuilderOutput,
            c8BuilderDepth: ambassador.c8BuilderDepth,
            c9EngagementAuth: ambassador.c9EngagementAuth,
            c10MissionAlign: ambassador.c10MissionAlign,
          },
          updatedAt: {
            c4: ambassador.c4UpdatedAt,
            c6: ambassador.c6UpdatedAt,
            c7: ambassador.c7UpdatedAt,
            c8: ambassador.c8UpdatedAt,
            c9: ambassador.c9UpdatedAt,
            c10: ambassador.c10UpdatedAt,
          },
          snapshotHistory: ambassador.xpSnapshotHistory,
          xpTrend: ambassador.xpTrend,
          cachedTotalXP: ambassador.totalXP,
        };
      }),

    // Update qualitative scores for an ambassador (admin only)
    // This sets C4/C6/C7/C8/C9/C10 and immediately recalculates XP
    updateQualitativeScores: adminProcedure
      .input(
        z.object({
          applicationId: z.number().int().positive(),
          c4ContentQuality: z.number().min(0).max(10).optional(),
          c6CommunityValue: z.number().min(0).max(10).optional(),
          c7BuilderOutput: z.number().min(0).max(10).optional(),
          c8BuilderDepth: z.number().min(0).max(10).optional(),
          c9EngagementAuth: z.number().min(0).max(10).optional(),
          c10MissionAlign: z.number().min(0).max(10).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { drizzle } = await import("drizzle-orm/mysql2");
        const { ambassadorApplications: appTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = drizzle(process.env.DATABASE_URL!);

        const ambassador = await getApplicationById(input.applicationId);
        if (!ambassador) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ambassador not found" });
        }

        const now = new Date();
        const updates: Record<string, unknown> = {};
        if (input.c4ContentQuality !== undefined) {
          updates.c4ContentQuality = input.c4ContentQuality;
          updates.c4UpdatedAt = now;
        }
        if (input.c6CommunityValue !== undefined) {
          updates.c6CommunityValue = input.c6CommunityValue;
          updates.c6UpdatedAt = now;
        }
        if (input.c7BuilderOutput !== undefined) {
          updates.c7BuilderOutput = input.c7BuilderOutput;
          updates.c7UpdatedAt = now;
        }
        if (input.c8BuilderDepth !== undefined) {
          updates.c8BuilderDepth = input.c8BuilderDepth;
          updates.c8UpdatedAt = now;
        }
        if (input.c9EngagementAuth !== undefined) {
          updates.c9EngagementAuth = input.c9EngagementAuth;
          updates.c9UpdatedAt = now;
        }
        if (input.c10MissionAlign !== undefined) {
          updates.c10MissionAlign = input.c10MissionAlign;
          updates.c10UpdatedAt = now;
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(appTable)
            .set(updates)
            .where(eq(appTable.id, input.applicationId));
        }

        // Recalculate XP for this ambassador immediately
        // Use in-memory merged object to avoid stale-read race condition with TiDB
        // (re-fetching via getApplicationById on a new connection may return old values)
        const merged = {
          ...ambassador,
          ...(input.c4ContentQuality !== undefined ? { c4ContentQuality: input.c4ContentQuality, c4UpdatedAt: now } : {}),
          ...(input.c6CommunityValue !== undefined ? { c6CommunityValue: input.c6CommunityValue, c6UpdatedAt: now } : {}),
          ...(input.c7BuilderOutput !== undefined ? { c7BuilderOutput: input.c7BuilderOutput, c7UpdatedAt: now } : {}),
          ...(input.c8BuilderDepth !== undefined ? { c8BuilderDepth: input.c8BuilderDepth, c8UpdatedAt: now } : {}),
          ...(input.c9EngagementAuth !== undefined ? { c9EngagementAuth: input.c9EngagementAuth, c9UpdatedAt: now } : {}),
          ...(input.c10MissionAlign !== undefined ? { c10MissionAlign: input.c10MissionAlign, c10UpdatedAt: now } : {}),
        };
        const updated = merged as typeof ambassador;
        if (updated) {
          const breakdown = await calculateTotalXP(updated);
          const snapshotHistory = addXPSnapshot(
            updated.xpSnapshotHistory as Array<{ date: string; xp: number }> | null,
            breakdown.totalXP
          );
          await db
            .update(appTable)
            .set({
              xpC1: breakdown.c1,
              xpC2: breakdown.c2,
              xpC3: breakdown.c3,
              xpC4: breakdown.c4,
              xpC5: breakdown.c5,
              xpC6: breakdown.c6,
              xpC7: breakdown.c7,
              xpC8: breakdown.c8,
              xpC9: breakdown.c9,
              xpC10: breakdown.c10,
              xpC11: breakdown.c11,
              totalXP: breakdown.totalXP,
              xpTrend: breakdown.trend,
              xpSnapshotHistory: snapshotHistory,
              xpUpdatedAt: now,
            })
            .where(eq(appTable.id, input.applicationId));
          return { success: true, breakdown };
        }
        return { success: true };
      }),
  }),

  // ── FEATURED POSTS ─────────────────────────────────────────────────────────
  featuredPosts: router({
    // Admin: list all featured posts (optionally filtered by ambassador)
    list: adminProcedure
      .input(z.object({ applicationId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.applicationId) {
          return getFeaturedPostsByAmbassador(input.applicationId);
        }
        return getAllFeaturedPosts();
      }),

    // Admin: create or update a featured post
    upsert: adminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          applicationId: z.number(),
          tweetUrl: z.string().min(1),
          caption: z.string().nullable().optional(),
          position: z.number().int().min(1).default(1),
          adminNote: z.string().nullable().optional(),
          isVisible: z.number().int().min(0).max(1).default(1),
        })
      )
      .mutation(async ({ input }) => {
        const id = await upsertFeaturedPost(input);
        return { id };
      }),

    // Admin: delete a featured post
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFeaturedPost(input.id);
        return { success: true };
      }),

    // Admin: reorder posts for an ambassador
    reorder: adminProcedure
      .input(
        z.object({
          applicationId: z.number(),
          orderedIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        await reorderFeaturedPosts(input.applicationId, input.orderedIds);
        return { success: true };
      }),

    // Public: get visible featured posts for a specific ambassador
    publicList: publicProcedure
      .input(z.object({ applicationId: z.number() }))
      .query(async ({ input }) => {
        const posts = await getFeaturedPostsByAmbassador(input.applicationId);
        return posts.filter((p) => p.isVisible === 1);
      }),
    // Public: get all visible featured posts (for leaderboard page)
    publicListAll: publicProcedure
      .query(async () => {
        const posts = await getAllFeaturedPosts();
        const visible = posts.filter((p) => p.isVisible === 1);
        // Enrich with tweet text from x_activity
        const db = await getDb();
        if (!db) return visible.map((p) => ({ ...p, tweetText: null }));
        const { xActivity } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const tweetUrls = visible.map((p) => p.tweetUrl);
        const activityRows = tweetUrls.length > 0
          ? await db.select({ tweetUrl: xActivity.tweetUrl, text: xActivity.text })
              .from(xActivity)
              .where(inArray(xActivity.tweetUrl, tweetUrls))
          : [];
        const textMap = new Map(activityRows.map((r) => [r.tweetUrl, r.text]));
        return visible.map((p) => ({ ...p, tweetText: textMap.get(p.tweetUrl) ?? null }));
      }),
  }),

  // ── DASHBOARD (handle-based, no auth required) ──────────────────────────────
  dashboard: router({
    byHandle: publicProcedure
      .input(z.object({ handle: z.string().min(1) }))
      .query(async ({ input }) => {
        const app = await getAmbassadorByHandle(input.handle);
        if (!app) return null;
        return app;
      }),

    rankContext: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getRankContext(input.applicationId);
      }),

    // Build Bible v1.2 Part 4.3 — the ambassador's personal referral code
    // (deterministic from the application id; safe to expose).
    referralCode: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { referralCodeFor } = await import("./referral");
        const app = await getApplicationById(input.applicationId);
        const handle = (app?.twitterHandle ?? "").replace(/^@/, "").toLowerCase();
        return {
          code: referralCodeFor(input.applicationId),
          handle: handle || null,
        };
      }),

    // S1 fix: was publicProcedure with caller-supplied applicationId — any
    // visitor could rewrite any ambassador's payout wallet. Now requires
    // login + the caller must own the target application (admins exempt).
    updateWallet: protectedProcedure
      .input(z.object({
        applicationId: z.number().int().positive(),
        walletAddress: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        await updateWalletAddress(input.applicationId, input.walletAddress);
        return { success: true };
      }),

    // S3 fix: builder submissions are XP-scoring; reading them is fine for
    // any logged-in user, but mutating them must be ownership-checked.
    builderSubmissions: protectedProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getBuilderSubmissions(input.applicationId);
      }),

    submitBuilder: protectedProcedure
      .input(z.object({
        applicationId: z.number().int().positive(),
        url: z.string().url(),
        submissionType: z.enum(["integration", "repository", "article", "tutorial", "event", "introduction", "translation", "bug_report", "other"]),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        const id = await createBuilderSubmission(input);
        return { id, success: true };
      }),

    deleteBuilder: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        applicationId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsApplication(ctx.user, input.applicationId);
        await deleteBuilderSubmission(input.id, input.applicationId);
        return { success: true };
      }),

    allBuilderSubmissions: adminProcedure
      .query(async () => getAllBuilderSubmissions()),

    // Public: get recent tweets for an ambassador (activity feed)
    recentTweets: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive(), limit: z.number().int().min(1).max(50).optional() }))
      .query(async ({ input }) => {
        const tweets = await getAmbassadorXActivity(input.applicationId);
        return tweets.slice(0, input.limit ?? 10);
      }),
    // Public: XP ledger breakdown by event_type for an ambassador
    xpLedgerBreakdown: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { xpEvents } = await import("../drizzle/schema");
        const { eq, sql: sqlFn } = await import("drizzle-orm");
        const rows = await db
          .select({
            eventType: xpEvents.eventType,
            source: xpEvents.source,
            totalXp: sqlFn<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)`,
            count: sqlFn<number>`COUNT(*)`,
          })
          .from(xpEvents)
          .where(eq(xpEvents.applicationId, input.applicationId))
          .groupBy(xpEvents.eventType, xpEvents.source)
          .orderBy(sqlFn`SUM(${xpEvents.xpAmount}) DESC`);
        return rows;
      }),
    // Public: top posts from x_activity for leaderboard (no curation needed)
    topXPosts: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { xActivity } = await import("../drizzle/schema");
        const { desc: descOrd, sql: sqlOrd } = await import("drizzle-orm");
        const limit = input.limit ?? 6;
        const { ne } = await import("drizzle-orm");
        // Engagement score: likes + replies*2 + retweets*3 + bookmarks
        // Exclude retweets — they carry the original post's engagement counts
        // (e.g. a retweet of a 900k-like post would dominate the list unfairly)
        const rows = await db
          .select({
            id: xActivity.id,
            tweetId: xActivity.tweetId,
            tweetUrl: xActivity.tweetUrl,
            text: xActivity.text,
            postedAt: xActivity.postedAt,
            likes: xActivity.likes,
            replies: xActivity.replies,
            retweets: xActivity.retweets,
            bookmarks: xActivity.bookmarks,
            tweetType: xActivity.tweetType,
            applicationId: xActivity.applicationId,
          })
          .from(xActivity)
          .where(ne(xActivity.tweetType, "retweet"))
          .orderBy(descOrd(sqlOrd`(COALESCE(${xActivity.likes},0) + COALESCE(${xActivity.replies},0)*2 + COALESCE(${xActivity.retweets},0)*3 + COALESCE(${xActivity.bookmarks},0))`))
          .limit(limit);
        return rows;
      }),
  }),
  // ── BADGE ROUTER ──────────────────────────────────────────────────────────
  badges: router({
    // Public: get active badge keys for an ambassador
    getActive: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => getActiveBadgeKeys(input.applicationId)),
    // Public: get all badge rows for an ambassador (active/dormant/locked)
    getAll: publicProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(async ({ input }) => getAllBadgeRows(input.applicationId)),
    // Admin: compute/refresh badges for one ambassador
    compute: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await computeBadgesForAmbassador(input.applicationId);
        return { success: true };
      }),
    // Admin: compute badges for all ambassadors
    computeAll: adminProcedure
      .mutation(async () => {
        const apps = await listApplications();
        for (const app of apps) {
          await computeBadgesForAmbassador(app.id);
        }
        return { count: apps.length };
      }),
    // Admin: toggle Evangelist badge manually
    toggleEvangelist: adminProcedure
      .input(z.object({
        applicationId: z.number().int().positive(),
        active: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db
          .select()
          .from(ambassadorBadges)
          .where(and(eq(ambassadorBadges.applicationId, input.applicationId), eq(ambassadorBadges.badgeKey, "evangelist")))
          .limit(1);
        const now = new Date();
        if (existing.length === 0) {
          await db.insert(ambassadorBadges).values({
            applicationId: input.applicationId,
            badgeKey: "evangelist",
            status: input.active ? "active" : "locked",
            awardedAt: input.active ? now : null,
          });
        } else {
          await db.update(ambassadorBadges)
            .set({
              status: input.active ? "active" : "dormant",
              awardedAt: input.active ? (existing[0].awardedAt ?? now) : existing[0].awardedAt,
              dormantAt: input.active ? null : now,
            })
            .where(eq(ambassadorBadges.id, existing[0].id));
        }
        await db.insert(badgeEvents).values({
          applicationId: input.applicationId,
          badgeKey: "evangelist",
          eventType: input.active ? "awarded" : "dormant",
          scoreAtEvent: 1,
        });
        return { success: true };
      }),
    // Admin: force override any badge status
    override: adminProcedure
      .input(z.object({
        applicationId: z.number().int().positive(),
        badgeKey: z.string(),
        status: z.enum(["active", "dormant", "locked"]),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db
          .select()
          .from(ambassadorBadges)
          .where(and(eq(ambassadorBadges.applicationId, input.applicationId), eq(ambassadorBadges.badgeKey, input.badgeKey)))
          .limit(1);
        const now = new Date();
        if (existing.length === 0) {
          await db.insert(ambassadorBadges).values({
            applicationId: input.applicationId,
            badgeKey: input.badgeKey,
            status: input.status,
            awardedAt: input.status === "active" ? now : null,
          });
        } else {
          await db.update(ambassadorBadges)
            .set({
              status: input.status,
              awardedAt: input.status === "active" ? (existing[0].awardedAt ?? now) : existing[0].awardedAt,
              dormantAt: input.status === "dormant" ? now : null,
              graceWindowEnd: null,
            })
            .where(eq(ambassadorBadges.id, existing[0].id));
        }
        await db.insert(badgeEvents).values({
          applicationId: input.applicationId,
          badgeKey: input.badgeKey,
          eventType: input.status === "active" ? "override_active" : "override_dormant",
          scoreAtEvent: 0,
        });
        return { success: true };
      }),
    // Admin: get badge event log
    eventLog: adminProcedure
      .input(z.object({ applicationId: z.number().int().positive().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const query = db.select().from(badgeEvents);
        if (input.applicationId) {
          return query.where(eq(badgeEvents.applicationId, input.applicationId));
        }
        return query;
      }),
  }),

  perks: router({
    // Public: list NachoNacho marketplace products with optional search, category, and pagination
    listProducts: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(100).optional().default(24),
      }).optional())
      .query(async ({ input, ctx }) => {
        const { search, category, page, pageSize } = input ?? {};
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const hiddenRows = await db.select({ productId: perksHiddenProducts.productId }).from(perksHiddenProducts);
        const hiddenIds = new Set(hiddenRows.map((r) => r.productId));
        const featuredRows = await db.select({ productId: perksFeaturedProducts.productId }).from(perksFeaturedProducts);
        const featuredIds = new Set(featuredRows.map((r) => r.productId));
        const isAdmin = ctx.user?.role === "admin";
        // Pass featuredIds/hiddenIds into fetchNachoNachoProducts so featured products are pinned to page 1
        const result = await fetchNachoNachoProducts({
          search, category, page: page ?? 1, pageSize: pageSize ?? 24,
          featuredIds, hiddenIds, isAdmin,
        });
        // Annotate products with isHidden/isFeatured flags
        const products = result.products.map((p) => ({
          ...p,
          isHidden: isAdmin ? hiddenIds.has(p.id) : false,
          isFeatured: featuredIds.has(p.id),
        }));
        return { ...result, products, hiddenIds: isAdmin ? Array.from(hiddenIds) : [], featuredIds: isAdmin ? Array.from(featuredIds) : [] };
      }),

    // Admin-only: get all hidden product IDs
    getHiddenIds: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select({ productId: perksHiddenProducts.productId }).from(perksHiddenProducts);
      return rows.map((r) => r.productId);
    }),

    // Admin-only: toggle a product visibility (hide=true hides it, hide=false shows it)
    toggleProductVisibility: adminProcedure
      .input(z.object({ productId: z.string().min(1), hide: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        if (input.hide) {
          await db.insert(perksHiddenProducts).ignore().values({
            productId: input.productId,
            hiddenAt: Date.now(),
            hiddenBy: ctx.user.email ?? ctx.user.openId,
          });
        } else {
          await db.delete(perksHiddenProducts).where(eq(perksHiddenProducts.productId, input.productId));
        }
        return { ok: true };
      }),
    // Admin-only: toggle a product as featured (featured=true pins it alphabetically to the top)
    toggleProductFeatured: adminProcedure
      .input(z.object({ productId: z.string().min(1), featured: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        if (input.featured) {
          await db.insert(perksFeaturedProducts).ignore().values({
            productId: input.productId,
            featuredAt: Date.now(),
            featuredBy: ctx.user.email ?? ctx.user.openId,
          });
        } else {
          await db.delete(perksFeaturedProducts).where(eq(perksFeaturedProducts.productId, input.productId));
        }
        return { ok: true };
      }),

    // Admin-only: get catalog status and trigger a rebuild
    catalogStatus: adminProcedure.query(() => {
      return getCatalogStatus();
    }),

    rebuildCatalog: adminProcedure.mutation(async () => {
      // Fire and forget — build runs in background
      buildFullCatalogInBackground().catch((err: Error) =>
        console.warn("[NachoNacho] Manual rebuild failed:", err.message)
      );
      return { ok: true, message: "Catalog rebuild started in background" };
    }),
  }),
});
export type AppRouter = typeof appRouter;

