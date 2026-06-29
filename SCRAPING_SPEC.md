# Ambassador Program — Scraping Specification

**Last updated:** 2026-05-20
**Status:** Fully implemented. Pipelines 1–3 are live in
`server/apifyPipeline.ts` + `server/xScraper.ts`. The "partial" status
below predated the live rollout and has been updated.

---

## Purpose

This document defines the complete intended scope of data extraction for the Ambassador Program tracking system. It covers what must be scraped, why, and how each data source maps to XP scoring components.

---

## 1. Ambassador Post Activity (C1, C2)

**What:** All original posts (not retweets) by each ambassador that mention brand-related content.

**Scope:**
- Posts from each ambassador's timeline containing any of: `@YOUR_OFFICIAL_HANDLE`, `#YOUR_TAG`, `your protocol`, `YOUR_TOKEN`, `your_official_handle`, `your-protocol.example.com`
- Includes threads — only the **opener tweet** (where `id == conversationId`) is recorded; replies within the ambassador's own thread are excluded

**Implementation status:** ✅ Implemented  
**Method:** Apify Twitter scraper + timeline fetch per ambassador  
**Stored as:** `x_activity` table, `tweetType = 'post'`

---

## 2. Ambassador Engagement Given (C3 — Bucket A)

**What:** All replies, quotes, and reposts made by ambassadors on brand-related content from any account.

**Scope — must track engagement by ambassadors on:**

| Source | Content type |
|---|---|
| @YOUR_OFFICIAL_HANDLE | All posts |
| @YOUR_SECONDARY_HANDLE | All posts |
| Any tweet containing `@YOUR_OFFICIAL_HANDLE`, `#YOUR_TAG`, `your protocol`, `YOUR_TOKEN`, `your_official_handle`, `your-protocol.example.com` | All posts |
| Other ambassadors' brand-related posts | All posts |

**Types of engagement to capture:**
- Replies by an ambassador to any of the above
- Quote tweets by an ambassador of any of the above
- Reposts (retweets) by an ambassador of any of the above

**Implementation status:** ✅ Implemented (Pipelines 2 + 3 are live)

Pipeline 2 (official-engagement) cross-references replies / quotes / reposts
on @YOUR_OFFICIAL_HANDLE and @YOUR_SECONDARY_HANDLE posts against the ambassador handle list.
Pipeline 3 (conversation threads) follows known ambassador conversation
IDs to pick up engagement that the keyword filter would miss.
Both are wired into `server/apifyPipeline.ts` and run on the scheduler.

**Stored as:** `x_activity` table, `tweetType = 'reply' | 'quote' | 'retweet'`

---

## 3. Engagement Received on Ambassador Posts (C3 — Bucket B)

**What:** Likes, replies, quotes, and reposts received on each ambassador's brand-related posts.

**Scope:** Engagement metrics on all posts captured in section 1 above.

**Implementation status:** ✅ Implemented  
**Method:** `likeCount`, `retweetCount`, `replyCount` stored per tweet in `x_activity`

---

## 4. @YOUR_OFFICIAL_HANDLE Post Tracking (official_updates)

**What:** All original posts from @YOUR_OFFICIAL_HANDLE.

**Scope:**
- All posts from @YOUR_OFFICIAL_HANDLE timeline
- Excludes retweets of other accounts
- Thread openers only (where `id == conversationId`)

**Implementation status:** ✅ Implemented  
**Stored as:** `official_updates` table

---

## 5. @YOUR_SECONDARY_HANDLE Post Tracking

**What:** All brand-related posts from @YOUR_SECONDARY_HANDLE.

**Scope:**
- Posts from @YOUR_SECONDARY_HANDLE containing brand-related keywords or mentioning @YOUR_OFFICIAL_HANDLE
- Thread openers only

**Implementation status:** ✅ Implemented as part of the official-engagement pipeline.

@YOUR_SECONDARY_HANDLE is in the official accounts list scraped by Pipeline 2 (see
`scrapeOfficialEngagement` in `server/xScraper.ts`). His posts feed the
community_posts table and act as cross-reference targets for ambassador
engagement scoring (C3).

---

## 6. Community Posts (community_posts)

**What:** brand-related posts from non-ambassador community members.

**Scope:**
- Posts containing brand keywords from accounts that are NOT in the ambassador list
- Thread openers only
- Excludes retweets

**Implementation status:** ✅ Implemented (manual CSV import workflow)

---

## Summary of Gaps

| Gap | Impact | Priority |
|---|---|---|
| Ambassador replies/quotes on @YOUR_OFFICIAL_HANDLE tweets not captured unless reply contains brand keyword | C3 Bucket A undercounts engagement given | **High** |
| Ambassador reposts of @YOUR_OFFICIAL_HANDLE/@YOUR_SECONDARY_HANDLE not captured | C3 Bucket A undercounts | **High** |
| @YOUR_SECONDARY_HANDLE not tracked as dedicated official source | Missing engagement context | **Medium** |
| Ambassador replies on @YOUR_SECONDARY_HANDLE tweets not captured | C3 Bucket A undercounts | **High** |

---

## Scraping Frequency

| Data source | Current frequency |
|---|---|
| Ambassador X activity | Daily (scheduler) |
| @YOUR_OFFICIAL_HANDLE + @YOUR_SECONDARY_HANDLE official-engagement (Pipeline 2) | Daily (scheduler) |
| Ambassador conversation threads (Pipeline 3) | Daily (scheduler) |
| Community posts (keyword scrape) | Daily (scheduler) |
| Telegram exports | Manual import (HTML) |

---

## XP Component Mapping

| Component | Data source | Status |
|---|---|---|
| C1 — Post Frequency | Ambassador posts (section 1) | ✅ |
| C2 — Post Consistency | Ambassador posts (section 1) | ✅ |
| C3 Bucket A — Engagement Given | Ambassador replies/quotes/reposts on YourProtocol content (section 2) | ✅ |
| C3 Bucket B — Reach Received | Engagement on ambassador posts (section 3) | ✅ |
| C4 — Content Quality | Manual admin scoring | ✅ |
| C5 — Telegram Participation | Telegram message count | ✅ |
| C6 — Community Value | Manual admin scoring | ✅ |
| C7 — Builder Output | Manual admin scoring | ✅ |
| C8 — Builder Depth | Manual admin scoring | ✅ |
| C9 — Engagement Authenticity | Manual admin scoring | ✅ |
| C10 — Mission Alignment | Manual admin scoring | ✅ |
| C11 — Application Quality | Test score (one-time) | ✅ |
