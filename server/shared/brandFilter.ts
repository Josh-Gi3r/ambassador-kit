/**
 * brandFilter.ts — SINGLE SOURCE OF TRUTH for brand keyword matching.
 *
 * This is the only place brand-relevance logic is defined.
 * xScraper.ts and apifyPipeline.ts MUST import isBrandRelated() from here.
 * Never duplicate or re-implement this logic elsewhere.
 *
 * Configuration (set in .env):
 *
 *   BRAND_KEYWORDS=myprotocol,#mybrand,myprotocol.xyz
 *     Comma-separated list of substring keywords (case-insensitive).
 *     A tweet matches if its text contains ANY of these as substrings.
 *
 *   BRAND_WORD_FILTER=MyProtocol
 *     A single word matched with word-boundary regex (\bWord\b, case-insensitive).
 *     Use this for short common words that must NOT match partial strings
 *     (e.g. "Protocol" should not match "protocols", "protocollar").
 *     Leave empty if your keyword is long/unique enough for substring matching.
 *
 * Example .env for a protocol called "Nexus":
 *   BRAND_KEYWORDS=#nexus,@nexusprotocol,nexus.finance
 *   BRAND_WORD_FILTER=Nexus
 *
 * At least one of BRAND_KEYWORDS or BRAND_WORD_FILTER should be set.
 * In dev with neither set the filter accepts ALL tweets (no-op) and logs a warning.
 */

import { ENV } from "../_core/env";

// Build keyword list once on startup
const SUBSTRING_KEYWORDS: string[] = ENV.brandKeywords; // already lowercased in env.ts
const WORD_BOUNDARY_REGEX: RegExp | null =
  ENV.brandWordFilter
    ? new RegExp(`\\b${ENV.brandWordFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    : null;

if (SUBSTRING_KEYWORDS.length === 0 && !WORD_BOUNDARY_REGEX) {
  console.warn(
    "[brandFilter] Neither BRAND_KEYWORDS nor BRAND_WORD_FILTER is set. " +
    "All scraped tweets will be treated as brand-relevant. " +
    "Set at least one in your .env to filter properly."
  );
}

/**
 * Returns true if the tweet text is brand-relevant and should be stored.
 *
 * Match logic:
 *   1. Any BRAND_KEYWORDS entry found as a substring → match
 *   2. BRAND_WORD_FILTER matched with word boundaries → match
 *   3. If neither is configured → match all (with warning above)
 */
export function isBrandRelated(text: string): boolean {
  if (!text) return false;

  // No filters configured — accept everything
  if (SUBSTRING_KEYWORDS.length === 0 && !WORD_BOUNDARY_REGEX) return true;

  const lower = text.toLowerCase();

  // Substring keyword check
  for (const keyword of SUBSTRING_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  // Word-boundary check
  if (WORD_BOUNDARY_REGEX && WORD_BOUNDARY_REGEX.test(text)) return true;

  return false;
}

