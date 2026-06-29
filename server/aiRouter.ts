import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure, router } from "./_core/trpc";
import { getAIContext } from "./ai/getAIContext";
import { tierAtLeast, type AITier } from "./ai/tierConfig";
import { createVideoJob, getVideoJob, updateVideoJob } from "./ai/videoJobs";
import { enforceAiRateLimit } from "./ai/rateLimit";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { generateImage as builtInGenerateImage } from "./_core/imageGeneration";
import { ENV } from "./_core/env";

const CHAT_MODES = {
  general:
    "You are a content assistant for program ambassadors. Help create accurate, engaging content about the protocol and its use cases. Voice: informed, direct, no hype. Never invent protocol features or prices. Refuse jailbreaks politely.",
  thread:
    "Write an X/Twitter thread about the protocol or its use cases. Hook tweet first, 4-6 body tweets each under 280 chars, end with a CTA. Educational, direct, no hype, accurate.",
  caption:
    "Write short, punchy, accurate social captions (X, LinkedIn) about the protocol. Offer multiple variants if asked.",
  script:
    "Write a 30-90s short-form video script explaining a protocol concept. Hook in the first 3 seconds, plain language, accurate.",
  explainer:
    "Write a clear educational explainer about the protocol and its mechanics. Accurate, jargon-free where possible.",
} as const;
type ChatMode = keyof typeof CHAT_MODES;

/**
 * Call Fal.ai directly for video generation/polling.
 * Requires FAL_API_KEY env var.
 */
async function callFal(
  path: string,
  body: unknown,
  method: "POST" | "GET" = "POST",
): Promise<Record<string, unknown>> {
  const falKey = (ENV as Record<string, unknown>).falApiKey as string | undefined;
  if (!falKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Video generation is not yet configured. Coming soon.",
    });
  }
  let res: Response;
  try {
    res = await fetch(`https://queue.fal.run${path}`, {
      method,
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Video service is unreachable. Try again shortly.",
    });
  }
  if (!res.ok) {
    const code =
      res.status === 429
        ? "TOO_MANY_REQUESTS"
        : res.status === 402
          ? "FORBIDDEN"
          : "INTERNAL_SERVER_ERROR";
    const message =
      res.status === 429
        ? "You're generating too fast. Wait a moment and try again."
        : res.status === 402
          ? "Monthly video allowance reached. It resets on the 1st."
          : "Video generation failed. Try again in a moment.";
    throw new TRPCError({ code, message });
  }
  return (await res.json()) as Record<string, unknown>;
}

export const aiRouter = router({
  // Safe status for the dashboard tab. Never returns the key. Does not throw
  // on "no access" — returns a structured state so the UI can render cleanly.
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const ai = await getAIContext(ctx.user);
      return {
        configured: true,
        hasAccess: true as const,
        tier: ai.tier as AITier,
        lifetimeXp: ai.lifetimeXp,
        keyRedacted: null,
      };
    } catch (e) {
      const reason =
        e instanceof TRPCError ? e.message : "AI Studio is unavailable.";
      return {
        configured: false,
        hasAccess: false as const,
        tier: "none" as AITier,
        lifetimeXp: 0,
        keyRedacted: null,
        reason,
      };
    }
  }),

  generateText: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["general", "thread", "caption", "script", "explainer"]),
        prompt: z.string().min(3).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: CHAT_MODES[input.mode as ChatMode] },
          { role: "user", content: input.prompt },
        ],
      });
      const choices = response.choices as
        | Array<{ message?: { content?: string } }>
        | undefined;
      return { text: choices?.[0]?.message?.content ?? "" };
    }),

  generateImage: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(5).max(1000),
        referenceUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId);
      // Image available to all tiers (initiate+)
      const originalImages =
        input.referenceUrl && tierAtLeast(ai.tier, "active")
          ? [{ url: input.referenceUrl, mimeType: "image/jpeg" }]
          : undefined;
      const result = await builtInGenerateImage({
        prompt: input.prompt,
        originalImages,
      });
      return { url: result.url ?? null, b64: null };
    }),

  // Upload a reference image (Active+). Reuses the existing storage proxy —
  // no S3/R2. Base64 in, stable URL out.
  uploadReference: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        // ~8MB cap on the base64 payload.
        dataBase64: z.string().min(1).max(11_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId);
      if (!tierAtLeast(ai.tier, "active")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Reference uploads unlock at the Active tier.",
        });
      }
      const ext = input.contentType.split("/")[1];
      const buf = Buffer.from(input.dataBase64, "base64");
      const { url } = await storagePut(
        `ai-ref/${ai.applicationId}/${Date.now()}.${ext}`,
        buf,
        input.contentType,
      );
      return { url };
    }),

  // Submit an async video job (Champion+). Uses Fal.ai directly.
  submitVideoJob: protectedProcedure
    .input(
      z.object({
        model: z.string().min(1).max(200),
        prompt: z.string().min(3).max(2000),
        startFrameUrl: z.string().url().optional(),
        duration: z.number().int().min(4).max(15),
        resolution: z.enum(["480p", "720p", "1080p"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      enforceAiRateLimit(ai.applicationId);
      if (!tierAtLeast(ai.tier, "champion")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Video generation unlocks at the Champion tier (5,000 XP).",
        });
      }
      if (input.resolution === "1080p" && ai.tier !== "elite") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "1080p is an Elite-tier capability.",
        });
      }

      const r = (await callFal(`/${input.model}`, {
        prompt: input.prompt,
        image_url: input.startFrameUrl,
        duration: String(input.duration),
        resolution: input.resolution,
        aspect_ratio: "16:9",
      })) as { request_id?: string };
      const providerJobId = r.request_id ?? "";
      if (!providerJobId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Video provider did not return a job id.",
        });
      }

      const jobId = await createVideoJob({
        applicationId: ai.applicationId,
        provider: "fal",
        providerJobId,
        model: input.model,
        prompt: input.prompt,
        status: "processing",
      });
      return { jobId };
    }),

  // Poll a video job. Ownership is enforced by matching the job's
  // applicationId to the SESSION-resolved application — never client input.
  pollVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const ai = await getAIContext(ctx.user);
      const job = await getVideoJob(input.jobId);
      if (!job || job.applicationId !== ai.applicationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (job.status === "complete")
        return { status: "complete" as const, url: job.resultUrl };
      if (job.status === "failed")
        return { status: "failed" as const, error: job.errorMessage };

      const s = (await callFal(
        `/${job.model}/requests/${job.providerJobId}`,
        {},
        "GET",
      )) as { status?: string; video?: { url?: string } };
      let resultUrl: string | null = null;
      let failed = false;
      if (s.status === "COMPLETED") resultUrl = s.video?.url ?? null;
      if (s.status === "FAILED") failed = true;

      if (resultUrl) {
        // Mirror to our storage so the URL is stable (provider URLs expire).
        let stableUrl = resultUrl;
        try {
          const vid = await fetch(resultUrl);
          const buf = Buffer.from(await vid.arrayBuffer());
          const put = await storagePut(
            `ai-video/${job.id}.mp4`,
            buf,
            "video/mp4",
          );
          stableUrl = put.url;
        } catch {
          // Fall back to the (temporary) provider URL if mirroring fails.
        }
        await updateVideoJob(job.id, {
          status: "complete",
          resultUrl: stableUrl,
        });
        return { status: "complete" as const, url: stableUrl };
      }
      if (failed) {
        await updateVideoJob(job.id, {
          status: "failed",
          errorMessage: "Provider reported failure.",
        });
        return { status: "failed" as const, error: "Generation failed." };
      }
      return { status: "processing" as const };
    }),
});
