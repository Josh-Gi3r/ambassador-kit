<div align="center">

# Ambassador Kit

### Run a community ambassador program where every point of XP traces back to a real post.

<a href="#"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
<a href="#"><img src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React"></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-555?style=flat-square" alt="MIT"></a>

</div>

<div align="center"><img src="./docs/hero.png" alt="Ambassador Kit screenshot" width="90%" /></div>

---

**Ambassador Kit is a self-hostable, brand-configurable web platform that runs a crypto/protocol community ambassador program end to end.** People apply (taking a knowledge test), their X/Twitter and Telegram activity is auto-scraped and converted into XP, they climb a public leaderboard and earn requalifying tiers + badges — and those tiers unlock real rewards: a tier-gated multi-model AI content studio and a startup-deals/perks marketplace.

It's built for **growth, DevRel, and community teams** at protocols, token projects, and brands who want to reward contributors on verifiable activity instead of gut feel. The entire program reskins to any brand through environment variables — no source edits — so the same codebase runs for any protocol.

---

## What you can build

- **A full ambassador program for a protocol or token.** Applicants pass an embedded knowledge test, get auto-admitted or admin-reviewed, link their socials, and start earning XP for on-brand posting, threads, replies, and community help — replacing the "who's actually active?" spreadsheet with a live, auditable ledger.
- **A "who's really contributing" tracker.** Daily X scrapes plus uploaded Telegram exports turn genuine activity — including engagement members *give* on protocol threads, not just their own posts — into a public ranking, so rewards and shoutouts land on people you can verify.
- **A self-funding contributor loop.** The AI content studio members unlock at each tier is literally the tool they use to produce the content that earns the next tier — and AI access and perks step back if contribution drops.
- **A DevRel / open-source program.** Integrations, repositories, tutorials, and translations are first-class, high-value XP events (build_integration is worth 2000 XP), reviewed and scored by admins — not just tweet counts.
- **A founding-cohort or event shortlist.** Sort on trailing-90-day XP to surface the requalifying top tier for early access, or let the one-way founding-cohort latch close itself the moment the community crosses a combined-XP threshold or fills its seats.
- **A referral and growth push.** Deterministic per-member referral codes plus a weekly admin sweep attribute new-community growth to specific advocates, idempotently.
- **A branded public creator leaderboard.** Shareable handle-based profiles, badge stacks, podium, rank context, and a community-wide progress bar toward the founding close — all themeable to your brand.

---

## Features

### Application & onboarding

- **Multi-step application wizard with an embedded knowledge test.** `Apply.tsx` is a ~22-screen flow: email gate → intro → 10 multiple-choice knowledge-test questions (FX/CLOB/stablecoin-themed) → score → motivation → track selection (Community / Developer / Content, multi-select) → contribution intent → communities → social handles → community experience + links → protocol description → why-join → first-30-days → confirm. Drafts autosave to `localStorage` and an existing applicant resumes mid-flow (the saved last step maps back to the right screen). Track can be pre-selected via a `?track=` URL param.
- **Auto-admit gate + evangelist fast-path.** A knowledge score of **≥6/10 auto-promotes** the applicant to Level 1 immediately; below that they stay L0 pending admin review. Evangelist-flagged applicants **skip the test entirely** and are assigned a perfect 10. Submissions are IP-rate-limited (10/hr submit, 60/hr progress), social handles are sanitized (strips `x.com`/`twitter.com` URLs and leading `@`), and the owner is notified on every new application.
- **Telegram Login Widget authentication.** Real HMAC-SHA256 verification of the Telegram login payload using `SHA-256(bot token)` as the secret key, with a **5-minute** `auth_date` replay window (tightened from the usual 24h). Issues a session JWT cookie and upserts the user with an `tg:<id>` openId, sitting alongside the template's email/OAuth login.
- **Telegram → application claim flow.** A Telegram-authed user links to an existing application three ways: auto-match by fuzzy `telegramHandle`, claim by typing their X/Twitter handle, or pick from a list of unclaimed applications. The link is permanent (`claimedByTgOpenId`) with double-claim and cross-claim conflict guards.

### XP engine

- **Live append-only XP ledger — a real accounting ledger, not a recomputed score.** `xp_events` is append-only; lifetime XP is `SUM(xp_amount)` and **only ever rises**, with an admin `gaming_reversal` row as the single controlled negative exception. An EARN table assigns fixed values to ~50 event types: post 50, thread 150, reply 10, quote 15, repost 5, received repost/quote/reply 30/40/20, tg_message 5, community session/event 500, build_integration 2000, build_repo 1500, build_article/tutorial 1000, on-chain swaps/sends, onboarding quests (200/100…), community_referral 75 / quality 150. Every event is **idempotent** via `UNIQUE(event_type, source_ref)`, so re-ingestion never double-awards. Lifetime / 30-day / 90-day sums are cached and recomputed per ambassador.
- **One-time freeze-and-carry migration.** `runOpeningBalanceMigration` reads each ambassador's existing displayed balance once and writes it as a single idempotent `migration_opening_balance` event — nobody is reset and the legacy number is never replayed. `verifyMigration` cross-checks for mismatches.
- **Legacy weighted 0–100 engine (frozen, still computed/displayed).** An 11-component formula (C1–C11) capping at 100 — post output, anti-dump posting spread, X engagement given + received, content quality, Telegram participation, community value, builder output/depth, engagement authenticity, mission alignment, and application/test quality. Auto components use a rolling 14-day window; admin-scored components decay 25%/week; C11 never decays. Trend compares last-7d vs prior-7d average. It's still shown in the admin XP tab and dashboard breakdown, but the **ledger is canonical** for live lifetime XP, tiers, and badges.

### Tiers, founding cohort & evangelists

- **Requalifying tier engine (daily cron).** Tiers `initiate / active / champion / elite` resolve **purely from trailing-90-day XP** (active ≥1200, champion ≥2700, elite ≥3600 *and* account age ≥90d). Promotion is immediate; demotion is a single-band step-down after a **14-day grace** (owner notified, cancellable if XP recovers). L0 / fraud-flagged / claim-pending accounts are locked to `initiate`. The cron also reconciles account age and syncs the AI key budget on tier change. The result is **two-axis progression**: your lifetime XP record never decays, but tier *access* requalifies — you can lose access without ever losing your record.
- **Founding-member tier with a permanent one-way latch.** `founding_config` closes when community combined lifetime XP crosses `collectiveThreshold` (default 5,000,000) **OR** the eligible cohort fills `seatCap` (default 100), whichever comes first. Individual eligibility: lifetime ≥ `individualFloor` (2000), L1+, account age ≥30d, no fraud, not claim-pending, Telegram linked. On closure it awards `isFounding` to the earliest-by-lifetime winners, sets `closedAt` **forever**, and notifies the owner — a real scarcity mechanic wired into the cron. *(The schema also retains older "Solitaire" naming in `program_config`/`isSolitaire`; the new `founding_config` is the one the cron uses.)*
- **Evangelist program (manual, 12 seats, with step-back).** An admin-granted honor capped at **12 filled seats** (rejects when full), recording `evangelistGrantedAt`. The cron auto-tracks a 14-day step-back grace if an evangelist's tier falls below Champion, then clears the flag (owner notified) — but **lifetime XP is untouched**. Surfaced as its own leaderboard filter and badge. Evangelist is hand-picked, never auto-earned.

### Badges

- **14-badge engine with active / dormant / locked lifecycle + audit log.** Badges (defined in `shared/badges.ts` across 8 sections with steel/bronze/silver/gold frame tiers): `l1_contributor`, `l2_ambassador`, `evangelist`, `steady_hand`, `iron_rhythm`, `wordsmith`, `viral_voice`, `shipper`, `architect`, `first_responder`, `community_pillar`, `sharp`, `perfect`, `rising`. The engine awards/dorments per ambassador with a 14-day grace before going dormant; permanent badges (`l1`, `sharp`, `perfect`) never dorment; `rising` has **no grace** and drops immediately. Every transition writes a `badge_events` audit row. Consistency/engagement/momentum badges are evaluated against the **ledger 30d/90d caches** (e.g. steady_hand d30 ≥300, iron_rhythm d30 ≥1200, viral_voice d30 ≥600, rising = recent 30d outpacing older 90d); content/community/builder badges still read admin raw scores.
- **Leaderboard-row badge selection.** `getLeaderboardRowBadges` returns exactly **3 badges per row**: rank (l2 over l1), evangelist if held, and the single highest-tier achievement badge via a fixed `BADGE_TIER_PRIORITY` ordering (gold > silver > bronze > steel). Higher-tier badges visually suppress their lower-tier counterpart.

### X / Twitter ingestion

- **Three-pipeline Apify scraper.** **P1 (outbound):** one bulk Apify run for all ambassadors using `from:handle since:date` search terms, incremental from each ambassador's last completed run, brand-filtered, upserted with refreshed engagement metrics. **P2 (inbound_official):** pulls the official handle's timeline as seed posts. **P3 (inbound_mention):** feeds P1+P2 post IDs (last 30 days, batched 50) into a second "unlimited" conversation-tree actor to capture ambassadors' **replies/quotes/reposts inside protocol threads** — i.e. engagement *given*, not just their own posts. Tweet type is derived (post/reply/quote/retweet), quoted authors extracted, sub-10-char "articles" skipped, XP recalculated after each pipeline. The Apify token is sent via the `Authorization` header, never in the URL.
- **Configurable brand-relevance filter.** `isBrandRelated` supports `BRAND_KEYWORDS` (case-insensitive substring list) plus a single `BRAND_WORD_FILTER` matched with `\bword\b` boundaries (so "Protocol" won't match "protocols"). It's the single source of truth used by every scraper; with neither configured it accepts all tweets and logs a warning.
- **Avatar backfill from the X profile API.** Pulls each ambassador's profile image (handling both new `avatar.image_url` and legacy `profile_image_url_https` shapes) and upgrades `_normal` to `_400x400` resolution before saving.

### Telegram ingestion

- **HTML-export parser with 6-strategy sender matching.** Cheerio parses a Telegram desktop HTML export — message id, sender (inheriting for "joined" consecutive messages), UTC+08 timestamp, reply target, media presence, reaction emojis. Sender → ambassador resolution tries 6 strategies in priority order (exact Telegram handle → exact any-handle → collapsed display name "Mohil Sheth" → "mohilsheth" → prefix, preferring Telegram over Twitter on ties → first-word prefix), because exports only give display names, not handles. Unmatched senders are surfaced for manual admin mapping; `messageId` is UNIQUE for re-upload dedupe; `rematchNullRows` re-runs matching after logic changes.

### AI content studio (tier-gated)

- **180-model AI Studio (v5/v6).** `modelRegistry` holds **180 curated models** (15 per tier × 4 tiers × 3 modalities). Text runs via OpenRouter (Mistral/Gemini/Claude/GPT/DeepSeek… each with price, routing slug, vision flag); image + video via fal.ai (Nano Banana, GPT Image 2, etc.). A tier sees its own models plus all lower-tier models. Generation uses an async job pattern — text returns synchronously; image/video submit to a queue and a detached background poller (up to ~5 min) updates the log row while the client polls every 3s. Ships with an opinionated anti-AI-slop system prompt carrying per-platform (X/LinkedIn/Instagram) writing rules.
- **Atomic spend caps.** Monthly per-second video caps per tier (initiate 220 / active 330 / champion 550 / elite 880) and monthly dollar caps for text+image (env-tunable, defaults 5/15/30/60). Both use an atomic **reserve → reconcile → refund** pattern: a conditional SQL UPDATE reserves before any upstream call (closing the parallel-request race), reconciles to actual usage on completion, and refunds on failure/timeout. Over-cap requests are rejected showing used/cap.
- **Reference-image upload + vision-to-prompt enrichment.** Uploads accept only png/jpeg/webp/gif validated by **magic-byte sniffing** (rejects spoofed MIME, ~8MB cap). For non-vision image models given a reference image, an LLM first describes the image in technical visual detail and appends it to the prompt (the enriched prompt is surfaced in the UI); vision-capable models receive the image directly.
- **First-use verification gate.** Before using the Studio, a contributor submits X + Telegram handles (session-scoped, linked by email); admins approve/reject in a verifications tab. The frontend auto-unlocks via **server-authoritative** status polling, not localStorage.
- **Per-ambassador LiteLLM key provisioning.** On L1 grant, a per-ambassador LiteLLM virtual key is issued bound to the tier's `budget_id`, and the daily cron keeps it reconciled to the current tier. Entirely dev-safe: it no-ops and never throws when LiteLLM env vars are unconfigured.
- **A second, simpler built-in AI router.** Alongside the 180-model studio, `aiRouter` offers text generation in 5 preset modes (general / thread / caption / script / explainer) via the platform's built-in `invokeLLM`, built-in image generation, reference upload gated to Active+, and Champion+ async video via fal.ai directly (1080p reserved for Elite). Completed videos are mirrored into stable storage because provider URLs expire. Hourly per-application rate limiting throughout. **Both AI back-ends are wired into the app router.**

### Perks & deals

- **NachoNacho perks marketplace (live integration).** Token auth (cached ~50 min), full catalog crawled page-by-page in the background and persisted to a DB cache (30-min TTL, survives restarts, rebuilt on boot). Products are auto-classified into 13 industry categories by keyword rules and sorted so non-cashback offers (credits/bonuses/free/discounts) rank ahead of pure-cashback. Supports search, category filter, and pagination; while the full catalog is still building it serves page 1 immediately.
- **Admin curation + tier-gated access.** Admins hide products and feature products (pinned alphabetically to page 1); flags return only to admins. `PerksTab` gates deal types by level — initiate locked, active unlocks free-credits, champion+ unlocks cashback/discount/other — with locked cards and a coming-soon modal. A **separate, hardcoded startup-perks vault** (Notion, AWS Activate, Auth0, Magnific, Figma, Algolia, Atlassian, HubSpot, Stripe Atlas) is tier-locked with savings copy. *(The perks page is two things: the live NachoNacho marketplace and this hardcoded vault.)*

### Member dashboard & contribution tools

- **Public handle-based dashboard.** `/dashboard/:handle` works **without auth** for viewing. Tabs: overview, xp (C1–C11 breakdown + ledger breakdown by event type), badges, activity (recent tweets), builder, ai (the Studio), perks, journal, plan. Shows rank context, a deterministic referral code, and recent activity. Logged-in owners get a self-service Telegram/X mapping panel and an ownership-checked wallet-address field.
- **Private journal + accountability plans.** Per-ambassador journal and "plan" entries (10k-char content) with full CRUD. Every read and mutation calls `assertOwnsApplication`, so a logged-in user can only ever touch their own rows.
- **Builder submissions for C7/C8 scoring.** Ambassadors submit URLs in 9 typed categories (integration, repository, article, tutorial, event, introduction, translation, bug_report, other) with title/description; admins review and score toward Builder Output/Depth. Read is any-logged-in; create/delete are ownership-checked.
- **Deterministic referral system with weekly sweep.** Each application has a stable referral code derived from its id (`PREFIX + id.toString(36)`, default `AMB-`). Admins paste confirmed `(referralCode, joiner)` pairs; each writes one idempotent `community_referral` event (75 XP) keyed on the joiner handle, so a joiner can only ever credit one referral even across re-runs.

### Public leaderboard

- **Podium, dual sort, filters, feeds.** A top-3 podium, a toggle between **Lifetime XP** and **30-day XP** sort, track filter (community/developer/content/evangelist), name search, tier pills (initiate/active/champion/elite/⚡founding), trend pills, and per-row badge stacks. Includes a community progress bar toward the founding threshold, an admin-curated featured-posts wall enriched with scraped text, and a top-X-posts view ranked by engagement score (likes + replies×2 + retweets×3 + bookmarks, retweets excluded).

### Admin & operations

- **Admin console (9 tabs).** *applications* (review/approve/reject + notes, approval auto-recalcs XP, confirm Telegram claim), *rankings* (ranked leaderboard, recalc-all, evangelist mode), *xtracker* (per-ambassador + bulk P1/P2/P3 scrape triggers, `fromDate` override, avatar backfill, job status), *telegram* (HTML upload, sender mapping, rematch, unmatched list — auto recalc after), *xp* (edit C4–C10 qualitative scores with immediate recalc, fraud flag, level, evangelist candidate), *posts* (featured-post CRUD + drag reorder + visibility), *comms* (prewritten message-playbook templates for launch / badge-award / warning / strip / removal events), *aispend* (per-ambassador monthly video-second spend), *verifications* (approve/reject Studio access). Plus admin-only ledger migration, verify, run-cron-on-demand, and badge override/toggle/event-log endpoints.
- **Scheduled + webhook-driven scraping with ordered cron.** `node-cron` runs a daily scrape at **06:00 SGT (22:00 UTC)** and a weekly full-cohort scrape (Sunday 00:00 SGT) that forces history from `PROGRAM_START_DATE`; both run P1 → P2 → P3 then the ledger cron. There are also Apify webhook endpoints (`/api/webhooks/apify[/official|/conversation]`) and an authenticated `/api/internal/run-daily` trigger (`X-Scrape-Secret` header) plus per-pipeline internal triggers.
- **Fully env-driven, multi-tenant brand config.** Program name, official handles, brand keywords/word filter, program start date, CDN base for badge art, Apify actor IDs, referral prefix, and AI caps are all read from environment variables with safe dev defaults — the same codebase reskins to any protocol without source edits.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Wouter (routing), TanStack Query, Tailwind v4, Radix UI / shadcn components, Framer Motion, Recharts |
| API | tRPC v11 (end-to-end typed) with Zod v4 validation, Express |
| Data | **MySQL / TiDB** via Drizzle ORM (`mysql2`) |
| Auth | JWT session cookies (`jose`) + Telegram Login Widget HMAC verification |
| Ingestion | Apify actors (X scraping), Cheerio (Telegram HTML parsing), `node-cron` schedulers |
| AI (optional) | OpenRouter + fal.ai (180-model studio), optional LiteLLM proxy |
| Perks (optional) | NachoNacho public API |
| Tooling | TypeScript throughout, esbuild build, Vitest tests |

---

## Quickstart

```bash
# 1. Clone
git clone <your-fork-url> ambassador-kit
cd ambassador-kit

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — at minimum point it at a MySQL/TiDB database and set a session secret.

# 4. (optional) Seed demo data for local/staging
node seed_demo.mjs

# 5. Run
npm run dev
```

The app serves the client and API together. Open the URL printed by Vite, and add your email to `ADMIN_EMAILS` to be granted admin on first login. Every external integration is **bring-your-own-key** — leave a provider's keys blank and that feature simply stays dark, with no crashes.

---

## Configuration

All program config is environment-driven, with safe dev defaults in `server/config/brand.ts` and `server/_core/env.ts`. The same codebase reskins to any brand with no source edits.

**Brand / program**

| Variable | Purpose |
|----------|---------|
| `APP_NAME` | Display name of your program |
| `BRAND_OFFICIAL_HANDLES` | Official X handles to scrape (comma-separated) |
| `BRAND_KEYWORDS` | Case-insensitive keywords to filter scraped posts |
| `BRAND_WORD_FILTER` | Single whole-word brand term (`\bword\b` boundary match) |
| `PROGRAM_START_DATE` | Earliest date (`YYYY-MM-DD`) the weekly full scrape reaches back to |
| `VITE_CDN_BASE` | CDN base URL for badge / logo art |
| `ADMIN_EMAILS` | Comma-separated emails granted admin (alongside the owner openId) |

**Pluggable adapters** — each independent and bring-your-own-key. Leave the keys blank and the feature stays dark.

| Capability | Provider | Notes |
|------------|----------|-------|
| X / Twitter scraping | Apify (two actors) | bulk search actor + "unlimited" conversation actor |
| Telegram login & profile-claim | Telegram Bot (BotFather) | HMAC Login Widget auth, not live ingestion |
| AI Studio (180 models) | OpenRouter + fal.ai | text via OpenRouter, image/video via fal.ai |
| AI budgets (optional) | LiteLLM proxy | per-ambassador virtual keys; no-ops if unset |
| Perks marketplace | NachoNacho public API | live catalog crawl + cache |
| Cron auth | internal | `X-Scrape-Secret` header for `POST /api/internal/run-daily` |

AI spend caps (monthly video seconds and text/image dollar caps per tier) are env-tunable; see `server/ai/tierConfig.ts`.

---

## Make it yours

1. **Name & brand** — set `APP_NAME`, `BRAND_*`, `PROGRAM_START_DATE`, and `VITE_CDN_BASE`; review `server/config/brand.ts`.
2. **Handles & keywords** — point `BRAND_OFFICIAL_HANDLES` / `BRAND_KEYWORDS` / `BRAND_WORD_FILTER` at your community.
3. **XP rules** — earn values and the ledger live in `server/xpLedger.ts` (canonical); the legacy weighted engine is `server/xpEngine.ts`.
4. **Tiers & founding** — thresholds in `server/ledgerCron.ts` (`founding_config` collective/individual floors and seat cap).
5. **Badges** — rules and frame tiers in `server/badgeEngine.ts` and `shared/badges.ts`.
6. **AI tiers & caps** — model registry in `server/ai/modelRegistry.ts`, caps in `server/ai/tierConfig.ts`.
7. **Re-gate growth XP** — flip `ENABLE_UNVERIFIED_GROWTH` to `false` once you trust your member set (see Status).
8. **Disable what you don't need** — leave any adapter's env keys blank and that feature stays dark.

---

## Status — what's real vs stubbed

Honest notes before you commit — credibility over hype.

- **Anti-gaming detection is OFF by default.** Growth-mechanic XP (ambassador-to-ambassador amplification, showcase replies, received engagement) ships with a hardcoded `ENABLE_UNVERIFIED_GROWTH = true` owner override. The in-code comment is explicit that this is knowingly farmable because the authenticity/cluster-detection layer isn't built yet. Flip it to `false` to re-gate those event types.
- **The Builder auto-track (C7) is a stub.** "Pipeline 4 (Builder Track)" is an explicit TODO; C7 Builder Output currently just passes through the admin-set score. Builder credit otherwise comes from members submitting links that admins review and score manually.
- **Telegram tracking is upload-based, not a live bot.** Activity is ingested from manually uploaded Telegram HTML chat exports (admin upload). The bot token is used only for Login Widget HMAC auth / profile-claim, **not** live message ingestion.
- **Referral attribution is manual.** There's no `/refer` bot; an admin pastes confirmed `(referral-code, joiner)` pairs into the weekly sweep.
- **Two XP systems coexist (mid-migration).** The legacy 0–100 / C1–C11 weighted-decay engine is still computed and shown in the admin XP tab and dashboard breakdown, but the append-only ledger is canonical for live lifetime XP, tiers, and badges. The legacy daily-earn / AI-sync path is deliberately frozen.
- **Two AI back-ends coexist.** The 180-model `aiStudioRouter` (OpenRouter + fal.ai with $/second caps) and the simpler `aiRouter` (5 preset text modes via built-in `invokeLLM`, built-in image gen, fal-direct video) are both wired into the app router.
- **LiteLLM provisioning is no-op unless configured.** Without `LITELLM_URL` / master key set, per-ambassador key issuance and budget-sync silently do nothing.
- **The hardcoded startup-perks vault is coming-soon.** The Notion/AWS/Figma-style vault has empty redemption URLs and is marked `comingSoon`; only the NachoNacho marketplace is a live integration.
- **Real operation depends on external services and keys.** Apify (two actors) for X scraping, NachoNacho for perks, OpenRouter + fal.ai for AI, a Telegram bot token, and a MySQL/TiDB database. With none of these, the features degrade or no-op — nothing is mocked, but nothing works until you wire and pay.
- **Some legacy code & columns remain.** A webhook-callback scraper variant (`server/apifyPipeline.ts`) coexists with the in-process polling scraper; `Map.tsx` is unused base-template boilerplate; several schema columns (`aiTier`, `xpTier`, `weeklyScores`, `totalScore`, the v2.0 lifetimeXp daily-earn formula) are superseded and no longer read; the unused `@aws-sdk` deps aren't used by the storage proxy.
- **Demo data is for local/staging only.** `seed_demo.mjs` populates fabricated applicants/scores — not real members.

---

## License

MIT © 2026 — see [LICENSE](./LICENSE). Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).
