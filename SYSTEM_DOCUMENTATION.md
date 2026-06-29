# Ambassador Program — System Documentation

**Version:** 2.0 | **Date:** April 2026 | **Status:** Active

---

## 1. What We Are Building

The Ambassador Program is a structured, merit-based contributor program that identifies, ranks, and rewards community members who actively grow the protocol's ecosystem. It is not a static badge system — it is a **live, dynamic XP engine** where every participant's position changes continuously based on their actual on-chain and off-chain activity.

---

## 2. The Application Pipeline

Every person in the system entered through the application form at `/apply`. The form collects:

| Step | Data Collected |
|---|---|
| Email gate | Email address |
| Track selection | One or more of: Community, Developer, Content |
| Knowledge test | 10 multiple-choice questions about the protocol; scored 0–10 |
| Profile | Twitter/X handle, Telegram handle, GitHub handle, other links |
| Community experience | Yes/No + up to 5 community links with descriptions |
| Written answers | Three long-form questions (protocol description, personal benefit, first 30 days) |

**On submission:** anyone who scores `testScore > 0` is automatically promoted to **Level 1 Contributor**. Their profile appears on the public leaderboard immediately. No admin action is required for this step.

**Admin approval:** clicking "Grant Ambassador" in the admin panel sets the applicant to **Level 2 Ambassador** and awards the L2 badge. This is the only thing admin approval does — it does not gate leaderboard visibility or any other feature.

---

## 3. XP System

### 3.1 Overview

Every contributor has a **Total XP** score between 0 and 100. XP is the sum of 11 weighted components (C1–C11). The leaderboard is ranked by Total XP in descending order.

```
totalXP = C1 + C2 + C3 + C4 + C5 + C6 + C7 + C8 + C9 + C10 + C11
```

### 3.2 Component Table

| # | Component | Max XP | Type | Window |
|---|---|---|---|---|
| C1 | X Post Output | 12 | Auto (Apify) | Rolling 14-day |
| C2 | X Posting Spread | 10 | Auto (Apify) | Rolling 14-day |
| C3 | X Engagement | 14 | Auto (Apify) | Rolling 14-day |
| C4 | Content Quality | 12 | Admin-scored | 25%/week decay |
| C5 | Telegram Participation | 8 | Auto | Rolling 14-day |
| C6 | Community Value | 10 | Admin-scored | 25%/week decay |
| C7 | Builder Output | 8 | Admin-scored | 25%/week decay |
| C8 | Builder Depth | 6 | Admin-scored | 25%/week decay |
| C9 | Engagement Authenticity | 8 | Admin-scored | 25%/week decay |
| C10 | Mission Alignment | 7 | Admin-scored | 25%/week decay |
| C11 | Application Quality | 5 | One-time admin | Never decays |
| | **TOTAL** | **100** | | |

### 3.3 Auto Components

**C1 — X Post Output (max 12 XP)**
Counts original brand-related posts in the rolling 14-day window. Scoring: 0 posts = 0, 1 = 2, 2–3 = 5, 4–5 = 8, 6–7 = 10, 8+ = 12.

**C2 — X Posting Spread (max 10 XP)**
Counts distinct days with at least one brand post in the 14-day window. Rewards consistency over bursts.

**C3 — X Engagement (max 14 XP)**
Has two parts:
- **Primary (0–8 XP):** engagement GIVEN by the contributor — replies, quotes, and retweets on brand-related content in threads (tracked via Apify P3 pipeline).
- **Bonus (0–6 XP):** engagement RECEIVED on the contributor's own posts — weighted as quotes×4 + retweets×3 + replies×2.

The bonus component (`xpC3Bonus`) is stored separately and is used for the Viral Voice badge.

**C5 — Telegram Participation (max 8 XP)**
Measures message activity in the the program's Telegram group within the rolling 14-day window.

### 3.4 Admin-Scored Components

Admins enter raw scores (0–10) in the scoring panel. These are converted to XP using `(rawScore / 10) × max`.

| Component | Raw Input | XP Multiplier |
|---|---|---|
| C4 Content Quality | 0–10 | ×1.2 (max 12) |
| C6 Community Value | 0–10 | ×1.0 (max 10) |
| C7 Builder Output | 0–10 | ×0.8 (max 8) |
| C8 Builder Depth | 0–10 | ×0.6 (max 6) |
| C9 Engagement Authenticity | 0–10 | ×0.8 (max 8) |
| C10 Mission Alignment | 0–10 | ×0.7 (max 7) |
| C11 Application Quality | 0–10 | ×0.5 (max 5, one-time, never decays) |

**Decay:** Admin-scored components (C4, C6, C7, C8, C9, C10) decay at **25% per week** from the date of last update. C11 never decays — it is a one-time foundation score set at application review.

### 3.5 XP Trend

A weekly XP snapshot is stored in `xpSnapshotHistory`. The trend is calculated from the most recent snapshot delta:

- `+1` (RISING) — delta > +2 XP week-over-week
- `-1` (FALLING) — delta < -2 XP week-over-week
- `0` (STABLE) — within ±2 XP

The trend is displayed on the leaderboard as ↑ RISING (green), → STABLE (grey), or ↓ FALLING (red).

---

## 4. Scraping Pipelines

XP auto-components are powered by three Apify scraping pipelines:

| Pipeline | What It Does | DB `pipeline` value |
|---|---|---|
| P1 — Ambassador Outbound | Scrapes each contributor's X timeline for brand-related posts | `outbound` |
| P2 — Official Engagement | Scrapes @YOUR_OFFICIAL_HANDLE's timeline for seed tweet IDs | `inbound_official` |
| P3 — Conversation Threads | Crawls threads seeded by P1+P2 tweetIds; matches engagers to contributors | `inbound_mention` |

P3 is what feeds C3 primary (engagement given). P1 feeds C3 bonus (engagement received on own posts), C1 (post count), and C2 (spread).

---

## 5. Levels

| Level | Name | How It Is Set |
|---|---|---|
| 0 | Applicant | Default on form start |
| 1 | Contributor | **Automatic** — set on submission when `testScore > 0` |
| 2 | Ambassador | **Admin action** — clicking "Grant Ambassador" in admin panel |
| 3 | Lead Ambassador | Internal — set manually by team |
| 4 | Ecosystem Lead | Internal — set manually by team |
| 5 | Full-Time | Internal — set manually by team |

Only L1 and L2 are displayed on the public leaderboard.

---

## 6. Badge System

14 badges across 6 categories. All are server-computed by `badgeEngine.ts` after every XP update, stored in the `ambassador_badges` table.

| Badge | Tier | Trigger |
|---|---|---|
| L1 Contributor | Steel | `level >= 1` (automatic on test pass) |
| L2 Ambassador | Gold | `status === 'approved'` (admin grants) |
| Evangelist | Gold | Manual admin toggle only |
| Steady Hand | Bronze | `xpC2 >= 6` |
| Iron Rhythm | Silver | `xpC2 >= 9` |
| Wordsmith | Bronze | C4 admin score >= 7 |
| Viral Voice | Silver | `xpC3Bonus >= 3` (21+ received engagement points) |
| Shipper | Bronze | C7 admin score >= 4 |
| Architect | Gold | C8 admin score >= 8 |
| First Responder | Bronze | C6 admin score >= 7 |
| Community Pillar | Silver | C6 admin score >= 9 |
| Sharp | Steel | `testScore >= 8` (permanent) |
| Perfect | Gold | `testScore >= 10` (permanent) |
| Rising | Silver | 3 consecutive weekly snapshots with delta > +2 XP |

**Permanence:** Sharp, Perfect, and L1 Contributor badges never go dormant. All others have a 14-day grace window before going dormant if conditions drop below threshold. The Rising badge has no grace window — it goes dormant immediately when the streak breaks.

---

## 7. The Evangelist Cohort

The Evangelist badge is a special designation for the Token2049 Singapore cohort (up to 12 slots). It is awarded manually by the admin — there is no automatic trigger.

**Eligibility criteria (MASTER.md §7):** Consistency block (C1+C2) ≥ 15/30 XP, Total XP ≥ 40, no active C10 escalation flag.

**Maintenance floor:** Evangelists must maintain C1+C2 ≥ 15/30 XP on a rolling basis. If they fall below this floor for 14 consecutive days, the badge steps back. It can be re-awarded once criteria are met again.

**Manual revocation:** The admin can revoke the badge at any time for conduct, non-participation, or any reason at team discretion.

---

## 8. Admin Panel

| Feature | URL |
|---|---|
| Applications — review, grant/revoke Ambassador status | `/admin` |
| Per-ambassador scoring (C4, C6–C11 raw scores) | `/admin` → scoring panel |
| XP recalculation (single or bulk) | `/admin` → XTracker |
| Scrape control (P1, P2, P3) | `/admin` → XTracker |
| Evangelist badge toggle | `/admin` → scoring panel |
| Telegram activity import | `/admin` → TelegramTracker |

---

*This document reflects the system as built on the `claude/frontend-code-audit-1lDeZ` branch, April 2026. Source of truth for scoring rules is MASTER.md v6.1.*
