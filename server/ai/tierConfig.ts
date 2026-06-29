// ─────────────────────────────────────────────────────────────────────────────
// AI STUDIO TIER MODEL — Build Bible v1.2 (Part 6 / 9.4)
//
// AI access is gated by the requalifying `current_tier` (initiate / active
// / champion / elite) computed by the ledger cron — NOT by lifetime XP.
// The app names a CAPABILITY tier (draft/standard/quality/premium); the
// LiteLLM + MediaRouter config maps each alias to the current best model
// (rotating a model is a config edit, never a code change — Bible 9.3).
// ─────────────────────────────────────────────────────────────────────────────

// "none" = no AI access (L0, pending claim, or fraud-flagged).
export type AITier = "none" | "initiate" | "active" | "champion" | "elite";

// Stored requalifying tier (never "none").
export type XpTier = "initiate" | "active" | "champion" | "elite";

type AccessInput = {
  level: number;
  currentTier?: XpTier | string | null;
  claimPending?: number | boolean | null;
  fraudFlag?: number | boolean | null;
};

/**
 * AI-access tier = the requalifying current_tier, unless access is denied
 * (below L1, pending claim, or fraud-flagged → "none"). The cron owns the
 * tier; this only gates it. (Bible 9.6 — the one engine↔Studio seam.)
 */
export function resolveTier(app: AccessInput): AITier {
  if (Number(app.level ?? 0) < 1) return "none";
  if (app.claimPending) return "none";
  if (app.fraudFlag) return "none";
  const t = (app.currentTier ?? "initiate") as string;
  if (t === "elite" || t === "champion" || t === "active" || t === "initiate")
    return t;
  return "initiate";
}

const TIER_RANK: Record<AITier, number> = {
  none: 0,
  initiate: 1,
  active: 2,
  champion: 3,
  elite: 4,
};

export function tierAtLeast(current: AITier, required: AITier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

// N2 — per-tier monthly dollar caps for text and image generation. Video
// is tracked separately in seconds (VIDEO_CAPS in modelRegistry). These
// numbers are a starting floor — easy to tune via env var without
// touching the cap logic.
export const TEXT_DOLLAR_CAPS: Record<XpTier, number> = {
  initiate: Number(process.env.AI_TEXT_CAP_INITIATE ?? 5),
  active: Number(process.env.AI_TEXT_CAP_ACTIVE ?? 15),
  champion: Number(process.env.AI_TEXT_CAP_CHAMPION ?? 30),
  elite: Number(process.env.AI_TEXT_CAP_ELITE ?? 60),
};
export const IMAGE_DOLLAR_CAPS: Record<XpTier, number> = {
  initiate: Number(process.env.AI_IMAGE_CAP_INITIATE ?? 5),
  active: Number(process.env.AI_IMAGE_CAP_ACTIVE ?? 15),
  champion: Number(process.env.AI_IMAGE_CAP_CHAMPION ?? 30),
  elite: Number(process.env.AI_IMAGE_CAP_ELITE ?? 60),
};

export function dollarCapFor(tier: XpTier, modality: "text" | "image"): number {
  return (modality === "text" ? TEXT_DOLLAR_CAPS : IMAGE_DOLLAR_CAPS)[tier];
}

// Capability-tier aliases (Bible 9.3/9.4). The LiteLLM/MediaRouter config
// (Build Step 10, infra) maps these to concrete provider models.
export function modelForTier(
  tier: AITier,
  modality: "text" | "image" | "video",
): string | null {
  if (tier === "none") return null;
  if (modality === "text") {
    if (tier === "elite") return "ambassador-text-premium";
    if (tier === "champion") return "ambassador-text-quality";
    if (tier === "active") return "ambassador-text-standard";
    return "ambassador-text-draft"; // initiate
  }
  if (modality === "image") {
    if (tier === "elite") return "ambassador-image-premium";
    if (tier === "champion") return "ambassador-image-quality";
    if (tier === "active") return "ambassador-image-standard";
    return "ambassador-image-draft"; // initiate (draft image allowed; ref upload gated active+)
  }
  // video — Champion and above only (Bible 9.4)
  if (tier === "elite") return "ambassador-video-premium";
  if (tier === "champion") return "ambassador-video-standard";
  return null;
}
