# Ambassador Program — XP System Page Content

Version: Mar 17, 2026
URL: YOUR_APP_DOMAIN/xp

---

## PAGE: XP SYSTEM (`/xp`)

### Navigation
- YOUR_BRAND (logo / home link)
- Leaderboard
- My Dashboard
- Roles
- XP System (active)
- Apply

---

### Hero Section

**Eyebrow:** YOUR_PROTOCOL // AMBASSADOR PROGRAM

**Headline:** XP System

**Subhead tags:** Contribution // Consistency // Visibility

**Body:**
XP reflects what you do today.
The leaderboard is live. Your contribution is visible in real time.

---

### 00 // OVERVIEW — How XP Works

XP is the scoring system behind the Ambassador leaderboard. Every ambassador earns XP through contribution across X, Telegram, and the broader protocol ecosystem. XP determines your rank, your progression, and your eligibility for program milestones.

XP is how contribution becomes visible. The leaderboard shows who is showing up.

| Label | Value |
|---|---|
| Score range | 0 to 100 XP |
| Leaderboard | Live. Quantitative XP updates as contribution is detected. |
| Review cycle | Daily. The YourProtocol team reviews qualitative components every day. |
| Decay | Rolling window. Auto components (C1, C2, C3, C5) reflect the live 14-day window and drop to zero if activity stops. Admin-scored components (C4, C6, C7, C8, C9, C10) are static until the YourProtocol team updates them based on new work reviewed. |
| Snapshot | Daily. The official XP score is recorded once per day. |
| Trend | Compares last 7 days average to prior 7 days average. Rising, stable, or falling. |

---

### 01 // XP COMPONENTS — What Earns XP

XP is earned across multiple dimensions. The more dimensions you contribute to, the higher your total XP.

There is no single path to a high score. Builders earn through code and integrations. Creators earn through content and reach. Community operators earn through presence and introductions. The system recognises all of it.

---

#### C1 // X POST OUTPUT — Are you showing up?

How many brand-related posts you publish in a rolling 14-day window. This is the consistency signal.

| Posts in rolling 14-day window | XP earned |
|---|---|
| 0 posts | 0 |
| 1 post | 2 |
| 2–3 posts | 5 |
| 4–5 posts | 8 |
| 6–7 posts | 10 |
| 8+ posts | 12 (max) |

**Weight: 12% of total XP.**

Eight or more posts in the 14-day window earns the full 12 points.

**What counts as brand-related:** Posts that mention @YOUR_OFFICIAL_HANDLE, use #yourtag or $YOUR_TOKEN, or reference YourProtocol's technology in context.

---

#### C2 // X POSTING SPREAD — Are you present consistently?

How many distinct days in the rolling 14-day window you posted brand-related content. This separates showing up regularly from posting everything in one day.

| Distinct posting days in rolling 14-day window | XP earned |
|---|---|
| 0 days | 0 |
| 1 day | 2 |
| 2-3 days | 4 |
| 4-5 days | 6 |
| 6-8 days | 8 |
| 9+ days | 10 |

**Weight: 10% of total XP.**

Someone who posts 7 times on Monday and nothing for 13 days scores 2. Someone who posts once a day for 7 days scores 8. The system values presence over bursts.

---

#### C3 // X ENGAGEMENT — Is your content reaching people?

Total engagement earned across all your brand-related posts in the rolling 14-day window. The system weights by the effort the other person put in.

> **Note (audit C2):** The tables below are the user-facing
> *explainer*. The exact thresholds live in
> `server/xpEngine.ts` (`calculateC3`) and the canonical formula is in
> `MASTER.md` Section 4 (C3 primary + bonus split). If the two ever
> drift, treat `xpEngine.ts` as source of truth.

**Engagement hierarchy:**

| Interaction | XP per interaction | Why |
|---|---|---|
| Mention (someone tags you or YourProtocol in their own post) | 5 | Organic reach. Someone thought about YourProtocol independently. |
| Quote repost (someone quotes your post with commentary) | 4 | Amplification with added context. |
| Repost (share without commentary) | 3 | Distribution to a new audience. |
| Reply / comment | 2 | Conversation signal. |
| Like | 1 | Passive approval. |
| Bookmark | 1 | Saved for later. |

**Engagement scoring:**

| Total engagement points in rolling 14-day window | XP earned |
|---|---|
| 0-5 | 1 |
| 6-20 | 3 |
| 21-50 | 5 |
| 51-100 | 6 |
| 101-200 | 7 |
| 201-400 | 8 |
| 401-700 | 9 |
| 700+ | 10 |

**Weight: 10% of total XP.**

Engagement is capped if post output is low. Sustained reach is valued over momentary spikes.

**Reply quality filter:** Replies under 5 words are filtered from engagement points.

---

#### C4 // CONTENT QUALITY — Is your content accurate and substantive?

Reviewed by the YourProtocol team daily. This is the depth signal.

| Level | What it means |
|---|---|
| 0-2 | Inaccurate, copy-paste, or generic content with YourProtocol tagged on. |
| 3-4 | Surface-level. Correct but adds nothing beyond what is on the website. |
| 5-6 | Accurate and relevant. Standard ambassador output. |
| 7-8 | Original angle or insight. Teaches the reader something. |
| 9-10 | Creates new understanding. Technical depth. Content that others cite. |

**Weight: 12% of total XP.**

Admin-scored 0–10, mapped to 0–12 XP. Score is updated by the YourProtocol team as new content is reviewed. This component decays 25% per week without new activity.

---

#### C5 // TELEGRAM PARTICIPATION — Are you present in the community?

Substantive messages in YourProtocol Telegram groups over the rolling 14-day window. Single-word messages and emojis are filtered.

| Substantive messages in rolling 14-day window | XP earned |
|---|---|
| 0 | 0 |
| 1–4 | 1 |
| 5–9 | 3 |
| 10–19 | 5 |
| 20–29 | 7 |
| 30+ | 8 (max) |

**Weight: 8% of total XP.**

---

#### C6 // COMMUNITY VALUE — Are you helping others?

Reviewed by the YourProtocol team daily. Measures the quality of your community presence.

| Level | What it means |
|---|---|
| 0-2 | Minimal presence or contribution. |
| 3-4 | Occasional participation. |
| 5-6 | Active participant. Engages in discussions. |
| 7-8 | Reliable community member. Regularly helps newcomers. Flags issues. |
| 9-10 | Community pillar. Others look to them for answers. |

**Weight: 10% of total XP.**

Admin-scored 0–10, mapped to 0–10 XP. Score is updated by the YourProtocol team as community presence is observed. This component decays 25% per week without new activity.

---

#### C7 // BUILDER OUTPUT — Are you building?

Non-X, non-Telegram contributions. Tracked via submitted links.

| Contribution | XP per item |
|---|---|
| Working integration or demo built on YourProtocol | 20 |
| Open source tool or repository (functional, brand-related) | 15 |
| Published article or blog post | 10 |
| Tutorial or educational content (video, guide, thread) | 10 |
| Community event hosted or attended representing YourProtocol | 10 |
| Introduction or lead verified by the YourProtocol team | 8 |
| Translation or localisation of YourProtocol content | 8 |
| Bug report or doc feedback that results in a fix | 5 |

**Admin-scored 0–10, mapped to 0–8 XP. Weight: 8% of total XP.**

---

#### C8 // BUILDER DEPTH — Is what you built real?

Reviewed by the YourProtocol team. Functional, original work that uses YourProtocol's APIs correctly scores higher.

| Level | What it means |
|---|---|
| 0-2 | Minimal or non-functional output. |
| 3-4 | Basic output. Shows effort. |
| 5-6 | Functional. Works correctly. Uses YourProtocol as intended. |
| 7-8 | Strong. Original approach. Real understanding of YourProtocol architecture. |
| 9-10 | Exceptional. Novel tooling others can use. Reference-quality work. |

**Weight: 6% of total XP.**

Admin-scored 0–10, mapped to 0–6 XP. Score is updated by the YourProtocol team as new builder work is reviewed. This component decays 25% per week without new activity.

---

#### C9 // ENGAGEMENT AUTHENTICITY — Is your reach real?

Reviewed by the YourProtocol team. The system verifies that engagement is organic.

**Weight: 8% of total XP.**

---

#### C10 // MISSION ALIGNMENT — Do you represent YourProtocol accurately?

Reviewed by the YourProtocol team. Ambassadors who explain YourProtocol clearly, accurately, and compellingly earn full XP here.

**Weight: 7% of total XP.**

---

#### C11 // APPLICATION QUALITY — Your starting foundation.

Scored once at application time based on your knowledge test and long-form answers. This carries forward as a baseline.

**Weight: 5% of total XP.**

---

### 02 // FORMULA SUMMARY — The Full Picture

| Component | Weight | Max XP | Signal |
|---|---|---|---|
| X post output | 12% | 12 | Consistency |
| X posting spread | 10% | 10 | Regularity |
| X engagement | 14% | 14 | Participation |
| Content quality | 12% | 12 | Depth |
| Telegram participation | 8% | 8 | Presence |
| Community value | 10% | 10 | Helpfulness |
| Builder output | 8% | 8 | Shipping |
| Builder depth | 6% | 6 | Quality |
| Engagement authenticity | 8% | 8 | Credibility |
| Mission alignment | 7% | 7 | Accuracy |
| Application quality | 5% | 5 | Foundation |
| **Total** | **100%** | **100** | |

**Three blocks:**

| Block | Components | Weight | What it measures |
|---|---|---|---|
| Consistency | Post output + Posting spread | 22% | Are you showing up regularly? |
| Quality | Content quality + Community value + Builder depth + Engagement authenticity + Mission alignment | 43% | Is what you do substantive and real? |
| Activity | Engagement + Telegram + Builder output + Application | 35% | Are you engaging with the community and building? |

Consistent X presence drives up to 22% of your score. Quality contribution drives up to 43%. Community engagement and building activity account for 35%.

---

### 03 // DECAY — XP Reflects Now

XP reflects current contribution. This program is aggressive by design.

**Auto components** (post output, posting spread, engagement, Telegram participation) are calculated from a rolling 14-day window at all times. The leaderboard reflects this in real time.

**Qualitative components** (content quality, community value, builder depth, engagement authenticity, mission alignment) are admin-scored and decay 25% per week without new activity. If you stop contributing, your auto components also drop as their rolling windows empty — together that is the inactivity signal.

**Application quality** is the only component that persists permanently. Scored once. 5% weight.

**What this means in practice:** If you stop posting and engaging, your auto components (C1, C2, C3, C5) will drop to zero as the 14-day rolling window empties. That alone can remove up to 44 points from your score. Admin-scored components hold their value until the YourProtocol team updates them based on new work. The leaderboard reflects this daily. XP is a commitment.

---

### 04 // TREND — Where You Are Heading

The trend indicator compares your average XP over the last 7 days to your average over the 7 days before that.

| Trend | Condition |
|---|---|
| Rising | Recent 7-day average is more than 2 points higher than the prior 7-day average. |
| Stable | Difference is within 2 points either way. |
| Falling | Recent 7-day average is more than 2 points lower than the prior 7-day average. |

The trend is visible on the leaderboard and on your public profile. Rising signals commitment. Falling signals a need to re-engage.

---

### 05 // LEADERBOARD — Public and Live

The leaderboard at YOUR_APP_DOMAIN/leaderboard displays all approved ambassadors ranked by total XP.

| Feature | Detail |
|---|---|
| Update frequency | Live. Quantitative XP updates as data flows in. |
| Snapshot | Daily. Official XP recorded once per day. |
| Visibility | Public. Anyone can view it. |
| Ranking | By total XP. Relative position changes as others contribute. |
| Trend indicator | Rising, stable, or falling. Based on the last 14 days. |
| XP breakdown | Visible on each ambassador's public profile. |
| Badges | Displayed next to each ambassador's name. |
| Evangelist badge | Visually distinct. Gold-toned. |

Your position on the leaderboard changes as others contribute. The leaderboard reflects relative, current performance.

---

### 06 // EVANGELIST ELIGIBILITY — The Standard

The Evangelist badge is awarded by the YourProtocol team to ambassadors who carry the protocol at the highest level. The badge is a standard.

Evangelists represent YourProtocol in the rooms that matter most. The badge reflects sustained, visible commitment. It stays active as long as you do.

---

### 07 // XP VALUE — Why This Matters

XP is a reputation score. The value of XP grows as YourProtocol grows.

**Now:** XP determines your rank, your visibility, and your eligibility for program milestones. The ambassadors with the highest sustained XP are the first considered when opportunities arise.

**Competitions and airdrops:** As YourProtocol launches products and signs partners, the ambassador community benefits first. Stablecoin competitions, airdrops tied to milestones, and partner rewards flow to those with the highest XP. Higher XP means better chances and larger allocations.

**As the ecosystem grows:** The protocol is building real FX infrastructure with real partners. The community that builds it benefits as it scales. XP is the record of who was there and who showed up.

The people who are here now are building something real. XP reflects that contribution. The leaderboard reflects who is leading.

---

### 08 // PRINCIPLES — How We Built This

**// 01 — Consistency over spikes.**
Months of showing up outweigh one great post. The system rewards sustained contribution.

**// 02 — Quality over volume.**
Ceilings on volume ensure depth matters. The final point on every component requires quality.

**// 03 — Real engagement over manufactured reach.**
Mentions and quotes are weighted higher than likes. The system recognises organic reach.

**// 04 — Transparency.**
XP calculations are public. The leaderboard is public. Score breakdowns are visible. Everything is open.

**// 05 — Current contribution.**
XP reflects today. Decay ensures the leaderboard always shows who is active.

**// 06 — Universal earning.**
XP is earned across all dimensions regardless of track. The system rewards breadth without requiring it.

---

### CTA Section

**Eyebrow:** YOUR_PROTOCOL AMBASSADOR PROGRAM

**Headline:** The leaderboard is live.

**Button:** VIEW LEADERBOARD →

---

### Footer

DOC 04 // XP SYSTEM
YOUR PROTOCOL
Ambassador Program Documentation Stack
Public Reference // Version 3.0
Settle on YourProtocol.

---

*Document generated: Mar 17, 2026*
*Source: YOUR_APP_DOMAIN/xp*
