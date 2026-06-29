/**
 * AI Studio v5 — tRPC Router
 *
 * Exposes:
 *   aiStudio.listModels  — models visible to the caller's tier
 *   aiStudio.videoSpend  — current month video-second usage
 *   aiStudio.generate    — tier-gated generation (text/image/video)
 *   aiStudio.history     — recent generation log for the caller
 *   aiStudio.adminSpend  — admin: all ambassadors' video spend this month
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { desc, eq, and, sql as drizzleSql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getAIContext } from "./getAIContext";
import { generate, getVideoSpend, getDollarSpend } from "./generate";
import { getModelsForTier, type ModelTier } from "./modelRegistry";
import { enforceAiRateLimit } from "./rateLimit";
import { aiGenerationLog, aiVideoSpend, studioVerifications, ambassadorApplications } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";

export const aiStudioRouter = router({
  /**
   * List models visible to the caller's current tier.
   * Optionally filter by modality.
   */
  listModels: protectedProcedure
    .input(
      z.object({
        modality: z.enum(["text", "image", "video"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      return getModelsForTier(ai.tier as ModelTier, input.modality);
    }),

  /**
   * Get current month video-second spend for the caller.
   */
  videoSpend: protectedProcedure.query(async ({ ctx }) => {
    const ai = await getAIContext(ctx.user);
    const spend = await getVideoSpend(ai.applicationId, ai.tier as ModelTier);
    return { ...spend, tier: ai.tier as ModelTier };
  }),

  /**
   * N2 — current month $-spend for text + image (combined). Lets the UI
   * surface monthly burn the same way videoSpend already does.
   */
  dollarSpend: protectedProcedure.query(async ({ ctx }) => {
    const ai = await getAIContext(ctx.user);
    const [text, image] = await Promise.all([
      getDollarSpend(ai.applicationId, ai.tier as ModelTier, "text"),
      getDollarSpend(ai.applicationId, ai.tier as ModelTier, "image"),
    ]);
    return { text, image, tier: ai.tier as ModelTier };
  }),

  /**
   * Generate content (text / image / video).
   * Tier-gated server-side on every request + hourly rate limit (N2 fix:
   * was previously bypassed for the Studio path).
   */
  generate: protectedProcedure
    .input(
      z.object({
        modelId: z.number().int().positive(),
        prompt: z.string().min(1).max(4000),
        imageUrl: z.string().url().optional(),
        videoDuration: z.number().min(3).max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId);
      return generate({
        applicationId: ai.applicationId,
        tier: ai.tier as ModelTier,
        modelId: input.modelId,
        prompt: input.prompt,
        imageUrl: input.imageUrl,
        videoDuration: input.videoDuration,
      });
    }),

  /**
   * Get recent generation history for the caller.
   */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(aiGenerationLog)
        .where(eq(aiGenerationLog.applicationId, ai.applicationId))
        .orderBy(desc(aiGenerationLog.createdAt))
        .limit(input.limit);
    }),

  /**
   * Get generation counts by modality — used for AI Creator badge derivation.
   */
  generationStats: protectedProcedure.query(async ({ ctx }) => {
    const ai = await getAIContext(ctx.user);
    const db = await getDb();
    if (!db) return { total: 0, text: 0, image: 0, video: 0, videoSeconds: 0 };
    const rows = await db
      .select({
        modality: aiGenerationLog.modality,
        count: drizzleSql<number>`count(*)`,
        videoSecs: drizzleSql<number>`coalesce(sum(${aiGenerationLog.videoSeconds}), 0)`,
      })
      .from(aiGenerationLog)
      .where(
        and(
          eq(aiGenerationLog.applicationId, ai.applicationId),
          eq(aiGenerationLog.status, "success")
        )
      )
      .groupBy(aiGenerationLog.modality);
    const stats = { total: 0, text: 0, image: 0, video: 0, videoSeconds: 0 };
    for (const r of rows) {
      const cnt = Number(r.count);
      stats.total += cnt;
      if (r.modality === "text") stats.text = cnt;
      if (r.modality === "image") stats.image = cnt;
      if (r.modality === "video") { stats.video = cnt; stats.videoSeconds = Number(r.videoSecs); }
    }
    return stats;
  }),

  /**
   * Admin: get all ambassadors' video spend for the current month.
   */
  adminSpend: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    return db
      .select()
      .from(aiVideoSpend)
      .where(
        and(
          eq(aiVideoSpend.year, now.getUTCFullYear()),
          eq(aiVideoSpend.month, now.getUTCMonth() + 1)
        )
      )
      .orderBy(desc(aiVideoSpend.secondsUsed));
  }),

  /**
   * Submit first-use verification.
   *
   * N3 fix — was publicProcedure and accepted any email, which allowed
   * unauthenticated bulk harvesting of email↔X↔Telegram pairs and a
   * pre-emptive squat on a high-XP ambassador's email. Now requires login
   * and writes against the caller's session email. X/Telegram are still
   * accepted from input so the user can correct what's on file.
   */
  submitVerification: protectedProcedure
    .input(
      z.object({
        xHandle: z.string().min(1).max(100),
        telegramHandle: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const email = ctx.user.email?.toLowerCase();
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification requires an email on your account.",
        });
      }

      // Check if already submitted (by email — uniqueness column).
      const existing = await db
        .select()
        .from(studioVerifications)
        .where(eq(studioVerifications.email, email))
        .limit(1);
      if (existing.length > 0) {
        return { status: existing[0].status, alreadySubmitted: true };
      }

      // Link to ambassador application by the caller's email.
      const appRows = await db
        .select({ id: ambassadorApplications.id })
        .from(ambassadorApplications)
        .where(eq(ambassadorApplications.email, email))
        .limit(1);
      const applicationId = appRows.length > 0 ? appRows[0].id : null;

      await db.insert(studioVerifications).values({
        email,
        xHandle: input.xHandle.replace(/^@/, ""),
        telegramHandle: input.telegramHandle.replace(/^@/, ""),
        applicationId: applicationId ?? undefined,
        status: "pending",
        submittedAt: Date.now(),
      });

      // Notify owner
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: "New AI Studio Verification Request",
          content: `Email: ${email}\nX: @${input.xHandle.replace(/^@/, "")}\nTelegram: @${input.telegramHandle.replace(/^@/, "")}\n${applicationId ? `Linked to application #${applicationId}` : "No matching application found"}`,
        });
      } catch (_) { /* non-fatal */ }

      return { status: "pending" as const, alreadySubmitted: false };
    }),

  /**
   * Check the caller's own verification status. N3 fix — was a
   * publicProcedure keyed on a caller-supplied email, which leaked which
   * emails had requested Studio access. Now scoped to the session.
   */
  checkVerification: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { status: null };
    const email = ctx.user.email?.toLowerCase();
    if (!email) return { status: null };
    const rows = await db
      .select({ status: studioVerifications.status })
      .from(studioVerifications)
      .where(eq(studioVerifications.email, email))
      .limit(1);
    return { status: rows.length > 0 ? rows[0].status : null };
  }),

  /**
   * Protected: get the caller's own verification status by their ambassador application.
   * Used by the frontend to auto-unlock the Studio gate without relying on localStorage.
   */
  myVerificationStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { status: null as null | string };
    // First try to find by applicationId via getAIContext
    try {
      const ai = await getAIContext(ctx.user);
      const rows = await db
        .select({ status: studioVerifications.status })
        .from(studioVerifications)
        .where(eq(studioVerifications.applicationId, ai.applicationId))
        .limit(1);
      if (rows.length > 0) return { status: rows[0].status };
    } catch (_) { /* no application found */ }
    // Fallback: check by email if user has one
    if (ctx.user.email) {
      const rows = await db
        .select({ status: studioVerifications.status })
        .from(studioVerifications)
        .where(eq(studioVerifications.email, ctx.user.email.toLowerCase()))
        .limit(1);
      if (rows.length > 0) return { status: rows[0].status };
    }
    return { status: null as null | string };
  }),

  /**
   * Upload a reference image for use in generation.
   *
   * N5 fix — was accepting `text/plain` and `application/pdf` (which are not
   * reference images) and trusted the client's declared `contentType`. Now
   * restricted to true image types with a magic-byte check, so a caller
   * can't smuggle arbitrary bytes into the public S3 bucket by lying about
   * the MIME.
   */
  uploadReference: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
        dataBase64: z.string().min(1).max(11_000_000), // ~8MB cap
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId, 60); // 60 uploads/hour/user
      const buf = Buffer.from(input.dataBase64, "base64");
      if (buf.length < 8) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File is empty or invalid." });
      }

      // Magic-byte sniffing — first few bytes must match the declared MIME.
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
      // WEBP: "RIFF" then 4 bytes of size then "WEBP"
      const isWebp =
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
      const ok =
        (input.contentType === "image/png" && isPng) ||
        (input.contentType === "image/jpeg" && isJpg) ||
        (input.contentType === "image/gif" && isGif) ||
        (input.contentType === "image/webp" && isWebp);
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File contents do not match the declared image type.",
        });
      }

      const extMap: Record<string, string> = {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
      };
      const ext = extMap[input.contentType] ?? "bin";
      const { url } = await storagePut(
        `ai-ref/${ai.applicationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
        buf,
        input.contentType
      );
      return { url };
    }),

  /**
   * Poll the status of an async fal.ai generation job.
   * Returns the current status of a log row — clients poll this every 3s
   * after receiving status: "pending" from the generate mutation.
   */
  pollJob: protectedProcedure
    .input(z.object({ logId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(aiGenerationLog)
        .where(
          and(
            eq(aiGenerationLog.id, input.logId),
            eq(aiGenerationLog.applicationId, ai.applicationId)
          )
        )
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      const row = rows[0];

      return {
        logId: row.id,
        status: row.status as "pending" | "success" | "error",
        modality: row.modality as "text" | "image" | "video",
        imageUrl: row.modality === "image" ? (row.outputUrl ?? undefined) : undefined,
        videoUrl: row.modality === "video" ? (row.outputUrl ?? undefined) : undefined,
        text: row.modality === "text" ? (row.outputText ?? undefined) : undefined,
        videoSeconds: row.videoSeconds ?? undefined,
         costUsd: row.costUsd,
        errorMessage: row.errorMessage ?? undefined,
        enrichedPrompt: row.prompt ?? undefined,
      };
    }),

  /**
   * Admin: list all verification requests.
   */
  adminVerifications: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(studioVerifications)
      .orderBy(desc(studioVerifications.submittedAt));
  }),

  /**
   * Admin: approve or reject a verification.
   */
  reviewVerification: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["verified", "rejected"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(studioVerifications)
        .set({ status: input.status, reviewedAt: Date.now(), notes: input.notes ?? null })
        .where(eq(studioVerifications.id, input.id));
      return { ok: true };
    }),
});
