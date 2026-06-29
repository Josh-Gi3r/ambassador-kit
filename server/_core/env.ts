export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  llmApiUrl: process.env.LLM_API_BASE_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  // Comma-separated list of emails auto-promoted to admin on first login
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
  // Telegram bot token for Login Widget HMAC verification
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",

  // ── AI providers (all optional — routes return clear errors when absent) ──
  litellmUrl: process.env.LITELLM_URL ?? "",
  litellmMasterKey: process.env.LITELLM_MASTER_KEY ?? "",
  // Dev-only shared key for testing the AI spine before per-user key issuance
  litellmDevKey: process.env.LITELLM_DEV_KEY ?? "",
  // NachoNacho API key for marketplace product fetching
  nachoNachoApiKey: process.env.NACHONACHO_API_KEY ?? "",
  // OpenRouter: text + image generation across 120+ models
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  // fal.ai: video (and some image) generation
  falApiKey: process.env.FAL_API_KEY ?? "",

  // ── X / Twitter scraper ──────────────────────────────────────────────────
  // Apify API key for the tweet scraper actor
  apifyApiKey: process.env.APIFY_API_KEY ?? "",
  // Actor to run.  Default: apidojo/tweet-scraper (61RPP7dywgiy0JPD0).
  // Override SCRAPER_ACTOR_ID to swap in a compatible actor without touching code.
  scraperActorId: process.env.SCRAPER_ACTOR_ID ?? "61RPP7dywgiy0JPD0",
  // Secondary actor for conversation/reply tree scraping
  scraperUnlimitedActorId: process.env.SCRAPER_UNLIMITED_ACTOR_ID ?? "apidojo~twitter-scraper-lite",

  // ── Brand / program config ───────────────────────────────────────────────
  // Comma-separated X handles for official-account scraping (Pipeline 2 & 3).
  // Example: BRAND_OFFICIAL_HANDLES=myprotocol,myfounder
  brandOfficialHandles: (process.env.BRAND_OFFICIAL_HANDLES ?? "")
    .split(",").map(h => h.trim().replace(/^@/, "").toLowerCase()).filter(Boolean),

  // Comma-separated brand keywords for tweet relevance filtering.
  // Example: BRAND_KEYWORDS=#mybrand,myprotocol,myprotocol.xyz
  brandKeywords: (process.env.BRAND_KEYWORDS ?? "")
    .split(",").map(k => k.trim().toLowerCase()).filter(Boolean),

  // Single word for word-boundary regex filtering (no spaces, no #/@).
  // Example: BRAND_WORD_FILTER=MyProtocol
  brandWordFilter: process.env.BRAND_WORD_FILTER ?? "",

  // Earliest date to scrape (YYYY-MM-DD). Posts before this are ignored.
  programStartDate: process.env.PROGRAM_START_DATE ?? "2025-01-01",
};

/**
 * Fail loud on boot in production when required secrets are missing.
 * Only secrets whose absence silently breaks security primitives
 * (JWT signing, DB writes, Telegram auth) are required here.
 * Optional integrations (AI providers, Apify) are allowed to be empty
 * so dev can boot without a full .env.
 */
const REQUIRED_IN_PROD: Record<string, string> = {
  JWT_SECRET: ENV.cookieSecret,
  DATABASE_URL: ENV.databaseUrl,
  TELEGRAM_BOT_TOKEN: ENV.telegramBotToken,
};

export function assertRequiredEnv(): void {
  if (!ENV.isProduction) return;
  const missing = Object.entries(REQUIRED_IN_PROD)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(", ")}`,
    );
  }
}
