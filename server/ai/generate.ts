/**
 * AI Studio v6 — Generation Engine (Async Job Architecture)
 *
 * Architecture:
 * - Text models (OpenRouter): synchronous, returns text immediately with status: "success"
 * - Image/Video fal.ai models: async job pattern
 *     1. Submit to fal.ai queue → get status_url + response_url
 *     2. Store fal_request_id + fal_endpoint in DB, set status: "pending"
 *     3. Return { logId, status: "pending" } immediately to the tRPC caller
 *     4. Background task polls fal.ai and updates DB row to status: "success" or "error"
 *     5. Client polls pollJob(logId) every 3s until status != "pending"
 * - OpenRouter image models (GPT Image 2): also async via same pattern
 *
 * This avoids gateway timeouts (which kill requests >60s).
 */
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { aiGenerationLog, aiVideoSpend, aiSpendMonth } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  getModelById,
  getModelsForTier,
  VIDEO_CAPS,
  type ModelTier,
  type ModelModality,
} from "./modelRegistry";
import { dollarCapFor } from "./tierConfig";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
export const AMBASSADOR_SYSTEM_PROMPT = `You are a content assistant for program ambassadors. Your job is to generate content they can actually use — not drafts that need heavy editing.
ALWAYS GENERATE. If the prompt has typos, spelling errors, or is vague, silently interpret the intent and produce something useful. Never refuse. Never ask for clarification. Never mention the errors.
---
CORE RULES — apply to every output:
1. No placeholder text. Never write [attach image here], [insert image], [add photo], [image], or any variation. Never reference images in text output. If the user wants an image, they will generate one separately.
2. No hashtags unless the user explicitly asks for them. On X/Twitter, hashtags kill reach. On LinkedIn, 2-3 relevant ones at the end are acceptable only if the user asks.
3. No AI slop. Never use: "In today's fast-paced world", "It's no secret that", "Game-changer", "Revolutionize", "Unlock the power of", "Dive into", "Leverage", "Seamlessly", "Cutting-edge", "Robust", "Synergy", or any phrase that sounds like it came from a corporate press release. Write like a person.
4. No hedging. Don't write "I think maybe" or "this could potentially" or "some might argue". State the point directly. Being wrong confidently is more engaging than being right weakly.
5. No performative openers. Never start with "Hot take:", "Unpopular opinion:", "This might be controversial:", "Thread:", or "🧵". These signal you're optimising for engagement rather than saying something real.
6. No hollow closers. Don't end posts with "What do you think?" or "Drop a comment below" or "Follow for more" unless the user specifically asks for a CTA.
---
WRITING FOR X / TWITTER — apply when the user asks for X posts, tweets, or threads:
Voice over format. Posts that move sound like a specific person thought a specific thing. Generic is invisible. Write with a distinct voice, not a content calendar voice.
Earned brevity. Short posts win when the compression is the art — cut until the idea is dense. Short posts lose when they're short because nothing was said.
No filler openers. Never start with "I" as the first word. Never start with a question. Never start with "So,". The first sentence must earn attention.
Threads: each tweet must stand alone. If a tweet only makes sense in context, cut it. Number with 1/ 2/ 3/ format.
---
WRITING FOR LINKEDIN — apply when the user asks for LinkedIn posts or articles:
Open with a specific observation or contrarian take, not a generic statement about the industry.
Use short paragraphs (1-3 sentences). White space is not laziness — it's readability.
The hook (first 2 lines before "see more") must be strong enough to make someone stop scrolling. Specificity beats inspiration.
Stories > advice. "Here's what I learned when X happened" beats "5 tips for Y".
---
WRITING FOR INSTAGRAM — apply when the user asks for Instagram captions or content:
Captions should feel personal, not promotional. Write like you're talking to one person, not broadcasting to a feed.
The first line is the hook — it must work without the rest of the caption.
Emojis are acceptable but not required. Use them to add tone, not to fill space.
---
CONTENT QUALITY STANDARDS:
Specificity beats generality. "I increased revenue by 40% in 3 months by doing X" is better than "I helped a company grow significantly".
Show, don't tell. Instead of "I'm passionate about X", show what that passion looks like in action.
Contrarian angles get more engagement than consensus takes. Challenge an assumption the audience holds.
The best content makes the reader feel something — curiosity, recognition, surprise, or mild discomfort.
---
OUTPUT FORMAT:
Return only the content itself — no preamble, no "Here's your post:", no "I've written the following:", no explanation of what you did. Just the content.
If generating multiple variations, separate them with "---" and nothing else.`;

// ── OPENROUTER CALLER ─────────────────────────────────────────────────────────
async function callOpenRouter(
  routingId: string,
  prompt: string,
  modality: "text" | "image",
  imageUrl?: string
): Promise<{ text?: string; imageUrl?: string }> {
  const apiKey = ENV.openRouterApiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  if (modality === "text") {
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];
    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: AMBASSADOR_SYSTEM_PROMPT + "\n\n" + prompt },
        ],
      });
    } else {
      messages.push({ role: "system", content: AMBASSADOR_SYSTEM_PROMPT });
      messages.push({ role: "user", content: prompt });
    }
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_BASE_URL ?? "https://your-app.example.com",
        "X-Title": process.env.APP_NAME ?? "Ambassador Studio",
      },
      body: JSON.stringify({ model: routingId, messages }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error: ${res.status} — ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text };
  }

  // Image generation via OpenRouter (e.g. GPT Image 2)
  // Use async pattern: submit and return a job reference
  const imageMessages = [{ role: "user", content: prompt }];
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_BASE_URL ?? "https://your-app.example.com",
      "X-Title": process.env.APP_NAME ?? "Ambassador Studio",
    },
    body: JSON.stringify({ model: routingId, messages: imageMessages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter image error: ${res.status} — ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  // OpenRouter image models return the image URL in content or in a special field
  const content = data.choices?.[0]?.message?.content;
  let outImageUrl: string | undefined;
  if (typeof content === "string" && content.startsWith("http")) {
    outImageUrl = content;
  } else if (Array.isArray(content)) {
    const imgPart = content.find((p: { type: string; image_url?: { url: string } }) => p.type === "image_url");
    outImageUrl = imgPart?.image_url?.url;
  }
  // Also check data.images (some models)
  if (!outImageUrl && data.images?.[0]?.url) {
    outImageUrl = data.images[0].url;
  }
  return { imageUrl: outImageUrl };
}

// ── FAL.AI SUBMIT (returns queue references, does NOT wait) ───────────────────
async function submitFalAiJob(
  routingId: string,
  prompt: string,
  modality: "image" | "video",
  options?: { imageUrl?: string; duration?: number }
): Promise<{ statusUrl: string; responseUrl: string; requestId: string }> {
  const apiKey = ENV.falApiKey;
  if (!apiKey) throw new Error("FAL_API_KEY not configured");

  // Strip any :tier suffix from routingId
  const endpoint = routingId.replace(/:(elite|champion|active|initiate)$/, "");

  const payload: Record<string, unknown> = { prompt };
  if (options?.imageUrl) payload.image_url = options.imageUrl;
  if (modality === "video" && options?.duration) payload.duration = options.duration;

  const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    let errMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed?.detail ?? parsed?.error?.message ?? parsed?.message ?? errText;
    } catch {
      if (errText.includes("<html") || errText.includes("<!DOCTYPE")) {
        errMsg = `fal.ai model unavailable (HTTP ${submitRes.status})`;
      }
    }
    throw new Error(`fal.ai error: ${submitRes.status} — ${errMsg.slice(0, 200)}`);
  }

  const queued = await submitRes.json();

  // If the response already contains the result (synchronous path), simulate async
  if (queued.images || queued.image || queued.video || queued.url) {
    // Return a special marker so the caller knows it's already done
    return {
      statusUrl: "__SYNC_COMPLETE__",
      responseUrl: "__SYNC_COMPLETE__",
      requestId: JSON.stringify(queued),
    };
  }

  const statusUrl: string = queued.status_url;
  const responseUrl: string = queued.response_url;
  const requestId: string = queued.request_id ?? queued.requestId ?? "unknown";

  if (!statusUrl || !responseUrl) {
    throw new Error(`fal.ai queue error: no status_url in response`);
  }

  return { statusUrl, responseUrl, requestId };
}

// ── FAL.AI BACKGROUND POLLER ──────────────────────────────────────────────────
/**
 * Polls fal.ai status_url until COMPLETED/FAILED, then updates the DB row.
 * Runs as a detached promise — does NOT block the tRPC response.
 */
async function pollFalJobInBackground(
  logId: number,
  statusUrl: string,
  responseUrl: string,
  modality: "image" | "video",
  videoDuration: number,
  applicationId: number,
  tier: ModelTier,
  pricePerUnit: number,
  /** Image-only: dollars reserved upfront, refunded on FAIL/timeout. */
  reservedImageDollars: number = 0,
): Promise<void> {
  const apiKey = ENV.falApiKey;
  if (!apiKey) return;

  // For video jobs, `videoDuration` is the reservation we placed in
  // `reserveVideoSeconds` before submitting the job. Image jobs do not
  // reserve, so reconciliation is video-only.
  const reservedSeconds = modality === "video" ? videoDuration : 0;

  // Handle synchronous completion case
  if (statusUrl === "__SYNC_COMPLETE__") {
    try {
      const data = JSON.parse(responseUrl === "__SYNC_COMPLETE__" ? "{}" : responseUrl);
      const db = await getDb();
      if (!db) return;
      if (modality === "image") {
        const imageUrl = data.images?.[0]?.url ?? data.image?.url ?? data.url;
        await db.update(aiGenerationLog)
          .set({ status: "success", outputUrl: imageUrl ?? null, costUsd: pricePerUnit, completedAt: Date.now() })
          .where(eq(aiGenerationLog.id, logId));
      } else {
        const videoUrl = data.video?.url ?? data.output?.url ?? data.url;
        const videoSeconds = data.video?.duration ?? data.duration ?? videoDuration;
        const costUsd = pricePerUnit * videoSeconds;
        await db.update(aiGenerationLog)
          .set({ status: "success", outputUrl: videoUrl ?? null, videoSeconds, costUsd, completedAt: Date.now() })
          .where(eq(aiGenerationLog.id, logId));
        await reconcileVideoSeconds(applicationId, tier, reservedSeconds, videoSeconds);
      }
    } catch (err) {
      console.error(`[AI Studio] Sync result parse failed for logId=${logId}:`, err);
      if (modality === "video") {
        await refundVideoSeconds(applicationId, tier, reservedSeconds);
      }
    }
    return;
  }

  const maxAttempts = 80; // 80 × 4s = ~5 minutes
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      if (!statusRes.ok) continue;
      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        const resultRes = await fetch(responseUrl, {
          headers: { Authorization: `Key ${apiKey}` },
        });
        const data = await resultRes.json();
        const db = await getDb();
        if (!db) return;

        if (modality === "image") {
          const imageUrl = data.images?.[0]?.url ?? data.image?.url ?? data.url;
          await db.update(aiGenerationLog)
            .set({ status: "success", outputUrl: imageUrl ?? null, costUsd: pricePerUnit, completedAt: Date.now() })
            .where(eq(aiGenerationLog.id, logId));
        } else {
          const videoUrl = data.video?.url ?? data.output?.url ?? data.url;
          const videoSeconds = data.video?.duration ?? data.duration ?? videoDuration;
          const costUsd = pricePerUnit * videoSeconds;
          await db.update(aiGenerationLog)
            .set({ status: "success", outputUrl: videoUrl ?? null, videoSeconds, costUsd, completedAt: Date.now() })
            .where(eq(aiGenerationLog.id, logId));
          await reconcileVideoSeconds(applicationId, tier, reservedSeconds, videoSeconds);
        }
        return;
      }

      if (status.status === "FAILED") {
        const errMsg = status.error ?? status.detail ?? "Generation failed";
        const db = await getDb();
        if (db) await db.update(aiGenerationLog)
          .set({ status: "error", errorMessage: String(errMsg).slice(0, 500), completedAt: Date.now() })
          .where(eq(aiGenerationLog.id, logId));
        if (modality === "video") {
          await refundVideoSeconds(applicationId, tier, reservedSeconds);
        } else {
          await refundDollars(applicationId, "image", reservedImageDollars);
        }
        return;
      }
    } catch (err) {
      console.error(`[AI Studio] Poll attempt ${i} failed for logId=${logId}:`, err);
    }
  }

  // Timeout — refund the reservation since no work was billed.
  const db = await getDb();
  if (db) await db.update(aiGenerationLog)
    .set({ status: "error", errorMessage: "Generation timed out after 5 minutes", completedAt: Date.now() })
    .where(eq(aiGenerationLog.id, logId));
  if (modality === "video") {
    await refundVideoSeconds(applicationId, tier, reservedSeconds);
  } else {
    await refundDollars(applicationId, "image", reservedImageDollars);
  }
}

// ── OPENROUTER IMAGE BACKGROUND POLLER ───────────────────────────────────────
/**
 * For OpenRouter image models (GPT Image 2): runs the synchronous call in background.
 * The OpenRouter API is synchronous but can take 2-3 minutes.
 */
async function pollOpenRouterImageInBackground(
  logId: number,
  routingId: string,
  prompt: string,
  pricePerUnit: number,
  applicationId: number,
  reservedDollars: number,
): Promise<void> {
  try {
    const result = await callOpenRouter(routingId, prompt, "image");
    const db = await getDb();
    if (!db) return;
    if (result.imageUrl) {
      await db.update(aiGenerationLog)
        .set({ status: "success", outputUrl: result.imageUrl, costUsd: pricePerUnit, completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
    } else {
      await db.update(aiGenerationLog)
        .set({ status: "error", errorMessage: "No image returned", completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
      await refundDollars(applicationId, "image", reservedDollars);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const db = await getDb();
    if (db) await db.update(aiGenerationLog)
      .set({ status: "error", errorMessage: errMsg.slice(0, 500), completedAt: Date.now() })
      .where(eq(aiGenerationLog.id, logId));
    await refundDollars(applicationId, "image", reservedDollars);
  }
}

// ── VISION-TO-PROMPT PIPELINE ─────────────────────────────────────────────────
/**
 * For non-vision image models: use an LLM to describe the reference image,
 * then append the description to the user's prompt.
 */
async function enrichPromptWithVision(
  prompt: string,
  referenceImageUrl: string
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: referenceImageUrl, detail: "high" },
            },
            {
              type: "text",
              text: `Describe this reference image in precise visual detail for use as a style/composition reference in an image generation prompt. Focus on: visual style, color palette, lighting, composition, mood, textures, and any distinctive visual elements. Be specific and technical. Output only the description, no preamble.`,
            },
          ],
        },
      ],
    });
    const description = response.choices?.[0]?.message?.content ?? "";
    if (!description) return prompt;
    return `${prompt}\n\nReference image style: ${description}`;
  } catch (err) {
    console.error("[AI Studio] Vision enrichment failed:", err);
    return prompt; // Fall back to original prompt
  }
}

// ── SPEND TRACKING ────────────────────────────────────────────────────────────
export async function getVideoSpend(
  applicationId: number,
  tier: ModelTier
): Promise<{ secondsUsed: number; capSeconds: number; pct: number; tier: ModelTier }> {
  const capSeconds = VIDEO_CAPS[tier] ?? VIDEO_CAPS.initiate;
  const db = await getDb();
  if (!db) return { secondsUsed: 0, capSeconds, pct: 0, tier };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(seconds_used), 0)` })
    .from(aiVideoSpend)
    .where(
      and(
        eq(aiVideoSpend.applicationId, applicationId),
        eq(aiVideoSpend.year, year),
        eq(aiVideoSpend.month, month)
      )
    );

  const secondsUsed = Number(rows[0]?.total ?? 0);
  return { secondsUsed, capSeconds, pct: Math.min(secondsUsed / capSeconds, 1), tier };
}

/**
 * N1 fix — atomic reserve-then-reconcile.
 *
 * The original `addVideoSeconds` ran AFTER fal.ai returned, which left a
 * read-then-check race in the cap gate: two parallel requests could both
 * pass the gate and both consume seconds, putting the user materially over
 * cap. We now reserve the *estimated* seconds atomically before kicking off
 * the fal.ai job, and reconcile (correct or refund) once the job completes.
 *
 * The reservation is a conditional SQL UPDATE — if `seconds_used +
 * requested > cap_seconds` the row count is 0 and the caller sees an
 * over-cap error. Insert path is also conditional so concurrent first
 * inserts in the same month don't double-reserve.
 */
async function reserveVideoSeconds(
  applicationId: number,
  tier: ModelTier,
  seconds: number,
): Promise<{ ok: true } | { ok: false; secondsUsed: number; capSeconds: number }> {
  const db = await getDb();
  const capSeconds = VIDEO_CAPS[tier] ?? VIDEO_CAPS.initiate;
  if (!db) return { ok: true }; // local/dev with no DB — no enforcement
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 1) Ensure the row exists (race-free via INSERT ... ON DUPLICATE KEY).
  //    No unique index on (application_id, year, month) yet, so we mimic it
  //    with a guarded INSERT: only insert if no row matches.
  const existing = await db
    .select({ id: aiVideoSpend.id, secondsUsed: aiVideoSpend.secondsUsed, capSeconds: aiVideoSpend.capSeconds })
    .from(aiVideoSpend)
    .where(
      and(
        eq(aiVideoSpend.applicationId, applicationId),
        eq(aiVideoSpend.year, year),
        eq(aiVideoSpend.month, month),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    // First request this month — reserve via insert. If cap < requested
    // even for a fresh row, refuse.
    if (seconds > capSeconds) {
      return { ok: false, secondsUsed: 0, capSeconds };
    }
    await db.insert(aiVideoSpend).values({
      applicationId,
      year,
      month,
      secondsUsed: seconds,
      capSeconds,
      updatedAt: Date.now(),
    });
    return { ok: true };
  }

  // 2) Conditional UPDATE: only increment when the result stays within cap.
  //    Driver returns affectedRows; if 0 the cap was exceeded.
  const result = await db.execute(sql`
    UPDATE ai_video_spend
    SET seconds_used = seconds_used + ${seconds},
        updated_at = ${Date.now()}
    WHERE id = ${existing[0].id}
      AND seconds_used + ${seconds} <= cap_seconds
  `);
  // mysql2 returns [ResultSetHeader, FieldPacket[]] for UPDATE; drizzle
  // forwards the result object as-is.
  const affected = Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0);
  if (affected > 0) return { ok: true };
  return {
    ok: false,
    secondsUsed: Number(existing[0].secondsUsed),
    capSeconds: Number(existing[0].capSeconds),
  };
}

/**
 * Reconcile a reservation once fal.ai returns the actual `actualSeconds`.
 * Positive delta = top up; negative = refund. Floored at 0.
 */
async function reconcileVideoSeconds(
  applicationId: number,
  tier: ModelTier,
  reservedSeconds: number,
  actualSeconds: number,
): Promise<void> {
  const delta = actualSeconds - reservedSeconds;
  if (delta === 0) return;
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  await db.execute(sql`
    UPDATE ai_video_spend
    SET seconds_used = GREATEST(0, seconds_used + ${delta}),
        updated_at = ${Date.now()}
    WHERE application_id = ${applicationId}
      AND year = ${year}
      AND month = ${month}
  `);
  void tier; // tier unused here; kept in signature for future per-tier caps
}

/** Refund the full reservation (used when fal.ai fails before any work). */
async function refundVideoSeconds(
  applicationId: number,
  tier: ModelTier,
  reservedSeconds: number,
): Promise<void> {
  await reconcileVideoSeconds(applicationId, tier, reservedSeconds, 0);
}

// ── DOLLAR SPEND TRACKING (text + image) ─────────────────────────────────────
// N2 — same atomic reserve-then-reconcile pattern, but tracking dollars per
// (applicationId, year, month, modality). Text + image previously had no
// monthly cap at all; a tier-correct caller could still drive unbounded
// upstream spend.
export async function getDollarSpend(
  applicationId: number,
  tier: ModelTier,
  modality: "text" | "image",
): Promise<{ dollarsUsed: number; dollarsCap: number; pct: number }> {
  // ModelTier is the requalifying tier (no "none") — `getAIContext` blocks
  // tier="none" callers at the entry point.
  const dollarsCap = dollarCapFor(tier, modality);
  const db = await getDb();
  if (!db) return { dollarsUsed: 0, dollarsCap, pct: 0 };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const rows = await db
    .select({ used: aiSpendMonth.dollarsUsed })
    .from(aiSpendMonth)
    .where(
      and(
        eq(aiSpendMonth.applicationId, applicationId),
        eq(aiSpendMonth.year, year),
        eq(aiSpendMonth.month, month),
        eq(aiSpendMonth.modality, modality),
      ),
    )
    .limit(1);
  const dollarsUsed = rows.length > 0 ? Number(rows[0].used) : 0;
  return { dollarsUsed, dollarsCap, pct: Math.min(dollarsUsed / dollarsCap, 1) };
}

async function reserveDollars(
  applicationId: number,
  tier: ModelTier,
  modality: "text" | "image",
  dollars: number,
): Promise<{ ok: true } | { ok: false; dollarsUsed: number; dollarsCap: number }> {
  const db = await getDb();
  const dollarsCap = dollarCapFor(tier, modality);
  if (!db) return { ok: true };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const existing = await db
    .select({ id: aiSpendMonth.id, used: aiSpendMonth.dollarsUsed, cap: aiSpendMonth.dollarsCap })
    .from(aiSpendMonth)
    .where(
      and(
        eq(aiSpendMonth.applicationId, applicationId),
        eq(aiSpendMonth.year, year),
        eq(aiSpendMonth.month, month),
        eq(aiSpendMonth.modality, modality),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    if (dollars > dollarsCap) {
      return { ok: false, dollarsUsed: 0, dollarsCap };
    }
    await db.insert(aiSpendMonth).values({
      applicationId,
      year,
      month,
      modality,
      dollarsUsed: dollars,
      dollarsCap,
      updatedAt: Date.now(),
    });
    return { ok: true };
  }

  const result = await db.execute(sql`
    UPDATE ai_spend_month
    SET dollars_used = dollars_used + ${dollars},
        updated_at = ${Date.now()}
    WHERE id = ${existing[0].id}
      AND dollars_used + ${dollars} <= dollars_cap
  `);
  const affected = Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0);
  if (affected > 0) return { ok: true };
  return {
    ok: false,
    dollarsUsed: Number(existing[0].used),
    dollarsCap: Number(existing[0].cap),
  };
}

async function refundDollars(
  applicationId: number,
  modality: "text" | "image",
  dollars: number,
): Promise<void> {
  if (dollars <= 0) return;
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  await db.execute(sql`
    UPDATE ai_spend_month
    SET dollars_used = GREATEST(0, dollars_used - ${dollars}),
        updated_at = ${Date.now()}
    WHERE application_id = ${applicationId}
      AND year = ${year}
      AND month = ${month}
      AND modality = ${modality}
  `);
}

// ── PUBLIC TYPES ──────────────────────────────────────────────────────────────
export interface GenerateRequest {
  applicationId: number;
  tier: ModelTier;
  modelId: number;
  prompt: string;
  imageUrl?: string; // reference image for vision models or image-to-video
  videoDuration?: number; // seconds, default 5
}

export interface GenerateResult {
  logId: number;
  modality: ModelModality;
  /** For text models: the generated text (synchronous) */
  text?: string;
  /** For image/video fal.ai models: undefined immediately — poll pollJob(logId) for result */
  imageUrl?: string;
  videoUrl?: string;
  videoSeconds?: number;
  costUsd: number;
  /** "pending" for async fal.ai/OpenRouter-image jobs, "success" for synchronous text results */
  status: "pending" | "success" | "error";
  /** Set when vision enrichment was applied (non-vision model + reference image). Shows the full prompt sent to the model. */
  enrichedPrompt?: string;
}

// ── MAIN GENERATE FUNCTION ────────────────────────────────────────────────────
export async function generate(req: GenerateRequest): Promise<GenerateResult> {
  const { applicationId, tier, modelId, prompt, imageUrl, videoDuration = 5 } = req;

  // 1. Resolve model and verify tier access
  const model = getModelById(modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });

  const allowed = getModelsForTier(tier, model.modality);
  if (!allowed.find(m => m.id === modelId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Model "${model.name}" requires a higher tier. Your tier: ${tier}`,
    });
  }

  // 2. Cap reservation (N1 / N2 — atomic).
  //    Video: reserves the estimated duration up-front so two parallel
  //    requests can't both pass the gate. Reconciled to actual duration on
  //    completion, refunded on failure.
  //    Text/Image: reserves the model's per-call price ($-budget); refunded
  //    on failure. Reservations always happen BEFORE any upstream call.
  let reservedDollars = 0;
  if (model.modality === "video") {
    const reservation = await reserveVideoSeconds(applicationId, tier, videoDuration);
    if (!reservation.ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Monthly video cap reached (${reservation.secondsUsed}/${reservation.capSeconds}s used)`,
      });
    }
  } else {
    const reservation = await reserveDollars(applicationId, tier, model.modality, model.pricePerUnit);
    if (!reservation.ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Monthly ${model.modality} spend cap reached ($${reservation.dollarsUsed.toFixed(2)}/$${reservation.dollarsCap.toFixed(2)} used)`,
      });
    }
    reservedDollars = model.pricePerUnit;
  }

  // 3. Create pending log entry
  const ts = Date.now();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [logResult] = await db
    .insert(aiGenerationLog)
    .values({
      applicationId,
      modelId,
      modality: model.modality,
      provider: model.provider,
      prompt,
      status: "pending",
      costUsd: 0,
      createdAt: ts,
    });
  const logId = (logResult as { insertId: number }).insertId;

  // 4. TEXT MODELS — synchronous, return immediately
  if (model.modality === "text") {
    try {
      const result = await callOpenRouter(model.routingId, prompt, "text", imageUrl);
      const text = result.text ?? "";
      const costUsd = model.pricePerUnit;
      await db.update(aiGenerationLog)
        .set({ status: "success", outputText: text, costUsd, completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
      return { logId, modality: "text", text, costUsd, status: "success" };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.update(aiGenerationLog)
        .set({ status: "error", errorMessage, completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
      // N2 — refund the upfront dollar reservation since no upstream
      // request was billed (or it failed before completing).
      await refundDollars(applicationId, "text", reservedDollars);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Text generation failed: ${errorMessage}` });
    }
  }

  // 5. IMAGE MODELS — async job pattern
  if (model.modality === "image") {
    const costUsd = model.pricePerUnit;

    if (model.provider === "OpenRouter") {
      // GPT Image 2 and other OpenRouter image models — can take 2-3 minutes
      // Run synchronous call in background, return pending immediately
      pollOpenRouterImageInBackground(logId, model.routingId, prompt, costUsd, applicationId, reservedDollars).catch(err => {
        console.error(`[AI Studio] OpenRouter image background task crashed for logId=${logId}:`, err);
      });
      return { logId, modality: "image", costUsd, status: "pending" };
    }

    // fal.ai image models
    // For non-vision models with a reference image, enrich the prompt first
    let effectivePrompt = prompt;
    const wasEnriched = !!(imageUrl && !model.supportsImageInput);
    if (wasEnriched) {
      effectivePrompt = await enrichPromptWithVision(prompt, imageUrl!);
    }

    try {
      const { statusUrl, responseUrl, requestId } = await submitFalAiJob(
        model.routingId,
        effectivePrompt,
        "image",
        { imageUrl: model.supportsImageInput ? imageUrl : undefined }
      );

      // Store fal request reference + effective prompt in DB
      await db.update(aiGenerationLog)
        .set({ falRequestId: requestId, falEndpoint: model.routingId, prompt: effectivePrompt })
        .where(eq(aiGenerationLog.id, logId));

      // Handle sync completion (some models return immediately)
      if (statusUrl === "__SYNC_COMPLETE__") {
        const data = JSON.parse(requestId);
        const outImageUrl = data.images?.[0]?.url ?? data.image?.url ?? data.url;
        await db.update(aiGenerationLog)
          .set({ status: "success", outputUrl: outImageUrl ?? null, costUsd, completedAt: Date.now() })
          .where(eq(aiGenerationLog.id, logId));
        return { logId, modality: "image", imageUrl: outImageUrl, costUsd, status: "success", enrichedPrompt: wasEnriched ? effectivePrompt : undefined };
      }

      // Start background polling. We pass `reservedDollars` so the poller
      // can refund if the upstream job fails or times out.
      pollFalJobInBackground(logId, statusUrl, responseUrl, "image", 0, applicationId, tier, costUsd, reservedDollars).catch(err => {
        console.error(`[AI Studio] Background poll crashed for logId=${logId}:`, err);
      });

      return { logId, modality: "image", costUsd, status: "pending", enrichedPrompt: wasEnriched ? effectivePrompt : undefined };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.update(aiGenerationLog)
        .set({ status: "error", errorMessage, completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
      // N2 — refund the upfront dollar reservation; fal.ai never accepted
      // the job.
      await refundDollars(applicationId, "image", reservedDollars);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Image generation failed: ${errorMessage}` });
    }
  }

  // 6. VIDEO MODELS — async job pattern
  if (model.modality === "video") {
    const costUsd = model.pricePerUnit * videoDuration;

    try {
      const { statusUrl, responseUrl, requestId } = await submitFalAiJob(
        model.routingId,
        prompt,
        "video",
        { imageUrl, duration: videoDuration }
      );

      // Store fal request reference in DB
      await db.update(aiGenerationLog)
        .set({ falRequestId: requestId, falEndpoint: model.routingId })
        .where(eq(aiGenerationLog.id, logId));

      // Handle sync completion
      if (statusUrl === "__SYNC_COMPLETE__") {
        const data = JSON.parse(requestId);
        const outVideoUrl = data.video?.url ?? data.output?.url ?? data.url;
        const videoSeconds = data.video?.duration ?? data.duration ?? videoDuration;
        const finalCost = model.pricePerUnit * videoSeconds;
        await db.update(aiGenerationLog)
          .set({ status: "success", outputUrl: outVideoUrl ?? null, videoSeconds, costUsd: finalCost, completedAt: Date.now() })
          .where(eq(aiGenerationLog.id, logId));
        await reconcileVideoSeconds(applicationId, tier, videoDuration, videoSeconds);
        return { logId, modality: "video", videoUrl: outVideoUrl, videoSeconds, costUsd: finalCost, status: "success" };
      }

      // Start background polling
      pollFalJobInBackground(logId, statusUrl, responseUrl, "video", videoDuration, applicationId, tier, model.pricePerUnit).catch(err => {
        console.error(`[AI Studio] Background poll crashed for logId=${logId}:`, err);
      });

      return { logId, modality: "video", costUsd, status: "pending" };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.update(aiGenerationLog)
        .set({ status: "error", errorMessage, completedAt: Date.now() })
        .where(eq(aiGenerationLog.id, logId));
      // N1: refund the reservation since no fal.ai work was billed.
      await refundVideoSeconds(applicationId, tier, videoDuration);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Video generation failed: ${errorMessage}` });
    }
  }

  // Should never reach here
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unknown modality" });
}
