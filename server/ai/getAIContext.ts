import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import {
  getApplicationByEmail,
  getApplicationByClaimedTgOpenId,
  getApplicationByTelegramHandle,
} from "../db";
import { resolveTier, type AITier } from "./tierConfig";

/**
 * Resolve the ambassador application for the logged-in user.
 *
 * Mirrors the resolution order in `ambassador.myApplication`
 * (server/routers.ts) so AI access matches dashboard ownership exactly:
 *   1. Telegram users  → claimedByTgOpenId, then telegramHandle fuzzy match
 *   2. Others          → email match
 *
 * NOTE: this still relies on the existing claim flow, which the audit flagged
 * (S4 — no proof the Telegram user owns the X handle). That is a PRE-DEPLOY
 * blocker for the paid layer, not a pre-build one. Tracked separately.
 */
async function resolveApplicationForUser(
  user: User,
): Promise<Record<string, unknown> | null> {
  if (user.openId?.startsWith("tg:")) {
    const claimed = await getApplicationByClaimedTgOpenId(user.openId);
    if (claimed) return claimed as Record<string, unknown>;
    if (user.name) {
      const byHandle = await getApplicationByTelegramHandle(user.name);
      if (byHandle) return byHandle as Record<string, unknown>;
    }
    return null;
  }
  if (!user.email) return null;
  const byEmail = await getApplicationByEmail(user.email);
  return (byEmail as Record<string, unknown>) ?? null;
}

export type AIContext = {
  applicationId: number;
  tier: AITier;
  lifetimeXp: number;
};

/**
 * Server-only. Returns the AI context for the current user or throws a
 * typed tRPC error.
 *
 * AI generation uses the configured LLM API (invokeLLM + generateImage)
 * — no LiteLLM, no Railway, no external key required for text/image.
 * Video generation uses Fal.ai directly (FAL_API_KEY env var).
 */
export async function getAIContext(user: User): Promise<AIContext> {
  const app = await resolveApplicationForUser(user);
  if (!app) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No ambassador application linked to this account.",
    });
  }

  if (Number(app.claimPending ?? 0)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is pending verification. Check back soon.",
    });
  }
  if (Number(app.fraudFlag ?? 0)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI access is unavailable on this account.",
    });
  }

  const tier = resolveTier({
    level: Number(app.level ?? 0),
    currentTier: (app.currentTier as string | undefined) ?? "initiate",
    claimPending: Number(app.claimPending ?? 0),
    fraudFlag: Number(app.fraudFlag ?? 0),
  });

  if (tier === "none") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI access unlocks once you are an active contributor (L1+).",
    });
  }

  return {
    applicationId: Number(app.id),
    tier,
    lifetimeXp: Number(app.lifetimeXp ?? 0),
  };
}
