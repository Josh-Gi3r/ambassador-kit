/**
 * brand.ts — single source of truth for brand-specific configuration.
 *
 * Everything here is read from environment variables so operators can
 * customise without touching source code.  Sensible defaults are provided
 * so the app boots in dev without a full .env.
 *
 * WHAT GOES HERE:
 *   - Program/product name and tagline
 *   - Brand accent colour (used in OG meta, not as a CSS var — CSS is in index.css)
 *   - Official social handles tracked by the X scraper
 *   - Brand keywords used to filter scraped posts
 *   - CDN base for badge/logo assets
 *   - Program start date (earliest scrape boundary)
 *
 * WHAT DOES NOT GO HERE:
 *   - Secrets (API keys, DB URL) — those live in server/_core/env.ts
 *   - UI component copy — that lives in the pages/components themselves
 */

import { ENV } from "../_core/env";

/**
 * Official X handles whose posts seed Pipeline 2 (official timeline)
 * and Pipeline 3 (conversation threads).
 *
 * Set BRAND_OFFICIAL_HANDLES as a comma-separated list, e.g.:
 *   BRAND_OFFICIAL_HANDLES=myprotocol,myfounder
 *
 * The X scraper resolves "to:<handle>" and "from:<handle>" queries and
 * cross-references the ambassador handle list against these.
 */
export const BRAND_OFFICIAL_HANDLES: string[] =
  ENV.brandOfficialHandles.length > 0
    ? ENV.brandOfficialHandles
    : ["myprotocol"]; // placeholder — set BRAND_OFFICIAL_HANDLES in .env

/**
 * Primary official handle (used for "from:<handle> since:…" in Pipeline 2).
 * Defaults to the first entry in BRAND_OFFICIAL_HANDLES.
 */
export const BRAND_PRIMARY_HANDLE: string = BRAND_OFFICIAL_HANDLES[0];

/**
 * Earliest date to scrape — no posts before this will be fetched.
 * Format: YYYY-MM-DD.  Overridable via PROGRAM_START_DATE env var.
 */
export const PROGRAM_START_DATE: string =
  ENV.programStartDate || "2025-01-01";

/**
 * CDN base URL for badge/logo assets.  Must NOT have a trailing slash.
 * Set VITE_CDN_BASE in .env, e.g.:
 *   VITE_CDN_BASE=https://cdn.example.com/ambassador-kit/assets
 */
export const CDN_BASE: string =
  process.env.VITE_CDN_BASE?.replace(/\/$/, "") ??
  "https://cdn.example.com/ambassador-kit/assets"; // replace with your CDN
