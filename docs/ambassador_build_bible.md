YOUR PROTOCOL
AMBASSADOR PROGRAM
THE BUILD BIBLE
The complete, build-grade specification for the new XP system, the migration from the legacy engine, the AI Creator Studio, the Perks Vault, and the founding tier. One document. It replaces every prior draft.
Version: 1.2 — Build Specification (verified pricing; growth-mechanic XP; Evangelist track restored)
Date: May 2026
Audience: Developer (primary), Program operator (Parts 1–3, 11)
Supersedes: All prior drafts and briefs (v3–v8, the two v7 master docs, the AI Creator Stack specs). Where this document and any earlier file disagree, this document is correct.
How to read the status of every number in this document
EXACT — XP earn values (including the new growth-mechanic events), the engine logic, schema, the migration, founding-tier thresholds and pacing, the architecture and build sequence are final and computed. Build from them directly.
VERIFIED — the AI provider pricing in Part 9.3 is now filled from first-party provider pages (May 2026). Only the Viral/premium-tier model NAMES remain estimate-grade and are marked; their tier slots and the cost ceiling around them are final.
DECISION — a small number of items need a named human owner; all are listed in Part 12.
Contents
TOC \h \o "1-2"
0. Scope — What Is Revamped, What Is Legacy
This is a revamp of a live system, not a build from nothing. The single most important thing for the developer to understand before touching anything is the boundary: what gets torn out and rebuilt, what is legacy and must be left running untouched, and what is migrated.
0.1 REVAMPED — torn out and rebuilt
The scoring engine. The legacy 0–100 score (“totalXP”), the C1–C11 component model, the component weights, the decay logic, and the legacy daily-earn formula floor((totalXP/100)^0.8 × 50) — all removed. They are replaced by the new per-action XP engine specified in Part 4.
The tier-resolution logic, which is re-pointed at the new XP model (Part 6).
0.2 LEGACY — do not touch, keep running
The X scraper, the Telegram scraper, and the Apify ingestion pipeline. These collect raw activity and continue to run exactly as they do today.
The raw activity tables (x_activity, telegram_activity and equivalent). They keep being written to by the scrapers. The new engine reads from them; it does not change them.
The application form, the knowledge test, and Telegram authentication.
The badge engine as a system — though individual badge conditions that referenced C-components are re-pointed at new XP data (Part 10).
0.3 MIGRATED — carried forward, not rebuilt, not reset
Existing ambassadors keep the XP they have already earned. Their current balance is frozen and carried into the new system as an opening balance (Part 5). Nobody is reset to zero. The leaderboard never blinks.
The seam
The legacy system has one clean dividing line: the function that recalculates scores (recalculateAllXP() or equivalent).
Everything UPSTREAM of it — scrapers, raw activity tables — is legacy and stays.
Everything DOWNSTREAM of it — the scoring — is revamped.
The new engine consumes the same raw activity rows the scrapers already write. The ingestion layer does not know the scoring changed.
1. The Program — Vision & Model
1.1 The vision
Build the best ambassador community in crypto — thousands of real people marketing the protocol across the world — and reward them not with cash but with tiered AI creative tools and white-labelled software perks. The program grows the protocol’s reach at near-zero marginal cost and feeds YourProtocol’s own hiring pipeline.
1.2 The idea
Marketing normally costs money because you pay people. This program pays people in something else: tools and perks that feel valuable to them but cost YourProtocol close to nothing. It is an exchange — ambassadors give YourProtocol reach and content; the protocol gives them AI tools and software perks. The tool an ambassador is given is the same tool they use to make the content that earns them more standing. Reward and work are the same motion.
1.3 The loop
Post about the protocol, build, or refer real people → earn XP → climb tiers → unlock better AI models and deeper perks → make better content → post more → earn more XP. It compounds. No one is paid in cash; the climb is the payment, and the climb produces exactly the marketing the program needs.
1.4 The three components
Component
What it is
XP Engine
The new per-action scoring system. One XP number per ambassador, earned from actions, never decreasing. Ships first — everything else gates off it.
AI Creator Studio
A branded AI workspace — text, image, video — in the ambassador portal. Tiered: higher XP unlocks better models. Built second.
Perks Vault
Third-party software deals, branded “Program Perks,” unlocked deeper as XP rises. Sourced via a white-label partner (NachoNacho). Built third.
1.5 Why this model wins
It self-selects for real creators — people who grind for creative tools are people who create. Cash attracts mercenaries.
It compounds — a paid campaign stops when the budget stops; this strengthens every month an ambassador stays.
It is a hiring pipeline — the L1–L5 ladder runs alongside XP; the strongest ambassadors are pulled onto the the program team (Part 3).
It is a moat — a competitor can copy a token airdrop in a week; they cannot copy a living community of thousands who genuinely care.
2. The Two Numbers — XP and Tier
The system has exactly two ambassador-facing quantities. Conflating them is the single most expensive mistake available, so they are defined here precisely and used precisely everywhere after.
Quantity
Definition
Lifetime XP
One unbounded running total per ambassador. Every contribution adds to it. Nothing ever subtracts. It never decays. It is the ambassador’s permanent record and the basis for tier and for the founding tier. This is THE XP number.
30-Day XP
The sum of XP earned in the trailing 30 days. It is a windowed VIEW of the same earn events — not a separate balance. It rises and falls with recent activity. It is the leaderboard’s “who is active now” sort and the basis for tier requalification (Part 6).
Tier
The ambassador’s current status band (Initiate / Active / Champion / Elite). Tier gates AI Studio access and perks depth. Tier is requalified on the trailing-90-day window and CAN step down if activity lapses (Part 6).
The rule that prevents the most expensive mistake
Lifetime XP never goes down through inactivity — it is the banked record. (The one exception: confirmed-gaming reversal, an admin correction — see Part 4.5.)
Tier can go down — it is re-earned, like airline elite status. Lifetime XP is the miles; tier is the status.
30-Day XP is not a third balance — it is just a 30-day window over the same earn events.
Any build, any UI copy, or any reward that treats Lifetime XP and tier as the same thing is wrong.
Why tier must be able to fall: a reward that can never be lost stops driving behaviour the moment it is obtained. Every major loyalty program on earth requalifies status periodically for exactly this reason. Why the balance must never fall: clawing back a balance a member believes they earned reads as theft and triggers abandonment. The system gets its urgency from requalification, never from destroying banked value.
3. The Program Ladder (L1–L5) — and the Hiring Pipeline
The program has two progressions on two different axes. They must not be merged.
Axis
What it is
AI Tier (Initiate→Elite)
Automatic, formula-driven, requalifying. Gates AI Studio access and perks depth. Measures recent contribution. No human decision.
Program Level (L1→L5)
Human-assessed. The ambassador’s role and standing, and the path to a job at the program. Promotion is a YourProtocol-team judgement, informed by XP but not dictated by it.
3.1 The L1–L5 ladder
Level
Name
What it is
Visibility
L1
Contributor
Everyone starts here on passing the knowledge test.
Public
L2
Ambassador
The official title. Team-granted on demonstrated, sustained contribution.
Public
L3
Lead
Country or ecosystem lead; recruits and supports ambassadors below.
Internal
L4
Ecosystem Lead
Owns a corridor, market or dev ecosystem; ships protocol outcomes.
Internal
L5
Full-Time
On the the program team. The hire.
Internal
3.2 The hiring signal — an honest correction
XP does not identify who to hire
XP measures posting volume, spread, engagement, community presence, and admin-scored content quality. A prolific poster and a strong BD or DevRel hire are only weakly correlated.
Promotion past L2 is driven by a SEPARATE outcome record: verified integrations shipped, verified partner introductions that the the program team confirms led somewhere, verified on-chain activity attributable to the ambassador, events run, recruits who themselves became productive.
XP tells you who is loud. The outcome record tells you who moves the protocol. Hire on the second.
4. The XP Engine — Exact Specification
This is the developer-authoritative spec of the new scoring engine. It fully replaces the legacy 0–100 / C1–C11 model.
4.1 Core principle
XP is a single number per ambassador. It is the sum of XP-valued events. It only ever increases. There is no ceiling, no decay, no recalculation that can lower it. Every XP-earning action writes one immutable row to an event ledger; Lifetime XP is the sum of that ledger; 30-Day XP is the sum of the trailing 30 days of it.
4.2 XP earn values
Content & Advocacy (X):
Action
XP
Notes
Original post about the protocol
50
C&A
Thread about the protocol (3+ posts)
150
C&A
Reply to YourProtocol content
10
C&A
Quote tweet of YourProtocol content
15
C&A
Repost of YourProtocol content
5
C&A
Your post receives a repost
30
received
Your post receives a quote
40
received
Your post receives a reply
20
received
Engagement received is weighted by authenticity — reach from real, established accounts counts fully; manufactured engagement is discounted. The exact weighting is held server-side and unpublished, so it cannot be reverse-engineered into a farming target.
Growth mechanics (X) — the three behaviours the program pushes hardest:
Action
XP
Notes
Reply / quote / repost of ANOTHER registered ambassador's YourProtocol content
25
A2A
That ambassador's content receives engagement FROM another ambassador
+15
A2A, to the author
Reply under a third-party account that mentions YourProtocol (the showcase reply)
8
showcase
Engagement received on a showcase reply (repost / quote / reply back)
20 / 25 / 12
showcase, received
These three rows implement the program's three priority behaviours. They are deliberately structured so effort without quality earns almost nothing:
Ambassador-to-ambassador amplification (A2A). Replying to / quoting / reposting a fellow registered ambassador's YourProtocol content is a distinct, higher-value event than engaging a stranger (25 vs the base 10–15). It is a FLAT bonus — not scaled by the other ambassador's tier. Detection: the scraper cross-references the engaged-with handle against the ambassador registry (handles are already tracked). When the engagement lands, BOTH sides earn: the engager gets the 25 A2A event; the author gets a +15 “engaged by an ambassador” event on top of their normal received-engagement XP. This is the mechanic that makes ambassadors want each other to succeed — it is the community moat, made literal in the ledger.
The showcase reply (top-voice replies). A reply under any third-party account that mentions YourProtocol earns a small flat 8 XP — deliberately low. The real XP is in the engagement that reply receives. A lazy drive-by (“reminds me of YourProtocol” under a big account) gets no engagement and earns ~8 XP total; a sharp reply that genuinely showcases YourProtocol pulls reposts and quotes and earns real XP. The X algorithm itself is the quality filter — no admin curation of accounts, no approved list. The YourProtocol mention is only the DETECTION anchor (it is what makes the event scrapeable); it is not what makes it valuable.
The two stack. When an ambassador engages another ambassador's showcase reply, the engager earns the 25 A2A event and the author earns both their showcase received-engagement XP and the +15 ambassador-engagement bonus. This is intentional: it mechanically produces the “reply-guy swarm” — ambassadors piling onto each other's YourProtocol replies under big accounts — which is exactly the behaviour the program wants.
MANDATORY PRECONDITION — do not ship the growth-mechanic XP without this
A2A amplification is both the mechanic the program wants AND the easiest thing to fake: a ring of ambassadors liking and replying to each other every morning is a closed loop that mints XP with zero real reach.
The authenticity weighting (engagement from real, established accounts counts; manufactured engagement is discounted) and the backend cluster-detection (shared IP/device, identical timing signatures, near-duplicate content, reciprocal-only engagement graphs) MUST be live before the A2A and showcase events are enabled.
Without them, A2A amplification becomes A2A collusion. The detection layer is not optional polish — it is a launch gate for these three event types specifically.
Community (Telegram & real-world):
Action
XP
Notes
Substantive message in the program's channels (5+ words, not spam)
5
auto
Helping a newcomer (admin-confirmed)
100
admin
Flagging an issue that gets resolved
50
admin
Hosting or co-hosting a community session
500
admin
Representing the protocol at an event (logged)
500
admin
Building (portal submission, human-reviewed before XP is awarded):
Contribution
XP
Notes
Working integration or tool built on the protocol
2,000
review
Open-source repo, brand-related, functional
1,500
review
Published article or research piece
1,000
review
Tutorial, video, or educational guide
1,000
review
Verified introduction that reaches the the program team
500
review
Translation of YourProtocol content
400
review
Bug report or doc fix that gets implemented
300
review
Protocol App (on-chain):
Action
XP
Notes
First swap
100
once
Each swap after
10
repeat
First send
150
once
Each send after
10
repeat
Referral who signs up and completes first swap
100
repeat
Each P2P trade
20
repeat
Volume milestones, once each: $100 traded → 200 · $1,000 → 500 · $10,000 → 2,000 · $100,000 → 5,000. Swap-count milestones, once each: 5 → 250 · 25 → 750 · 100 → 2,000.
Onboarding quests, once per account:
Apply and pass the knowledge test 200 · score 8+ on the test +100 · perfect 10/10 +200 · connect X 100 · connect Telegram 100 · first YourProtocol post 100 · first app swap 100 · first app send 100 · first referral submitted 100 · first builder submission approved 200.
Ongoing quests and Quality Awards: configured by the the program team in the admin panel, with XP values set per quest/award. No fixed amounts; nothing formula-driven, so nothing to game.
4.3 Community Referrals
Bringing new people into the the program community is the third priority behaviour. It is distinct from the on-chain app referral above (which requires a completed swap). A community referral is: a new person joins the the program's Telegram, follows the X account, and identifies who brought them in.
How it works:
Every ambassador has a personal referral link / code, generated in their dashboard. (This is not built yet — it is a build item: generate a unique code per ambassador, surface it in the dashboard, Part 12.)
The new person joins the Telegram group and tags their referrer — e.g. “@alextan introduced me.”
A weekly admin sweep reads the new-joiner tags, matches each to a referrer, and credits the referrer with a community-referral XP event. The sweep is the v1 mechanism — manual, run weekly. A /refer bot command that auto-attributes on join is the noted later automation; it is not required for launch.
Action
XP
Notes
Community referral confirmed at the weekly sweep (to the referrer)
75
per joiner
A referred person themselves reaches Contributor (L1) — bonus to the referrer
150
quality referral
The referred person earns XP only from Contributor onward
A person who has joined Telegram but has not applied has no ambassador account — there is nowhere to hold XP, and crediting ghosts is unauditable.
Decision: the referred person earns their own XP only once they themselves reach Contributor (apply, pass the knowledge test, become L1). Until then, only the REFERRER is credited (the 75-XP sweep event).
When a referred person does reach Contributor, the referrer earns the additional 150-XP quality-referral bonus — this rewards bringing in people who genuinely convert, not just headcount.
4.4 The event ledger — the heart of the engine
Every XP-earning action writes exactly one row to xp_events. Lifetime XP is never stored as a mutable counter that gets written by many code paths — it is the SUM of this ledger (cached for read performance, but the ledger is the truth). This makes XP auditable, idempotent, and impossible to silently corrupt.
CREATE TABLE xp_events (
id              BIGINT PRIMARY KEY AUTO_INCREMENT,
application_id  INT NOT NULL,
event_type      VARCHAR(64) NOT NULL,   -- 'post','thread','a2a_amplify','showcase_reply',
-- 'community_referral','gaming_reversal',
-- 'migration_opening_balance',...
xp_amount       INT NOT NULL,           -- normally > 0; NEGATIVE only for
-- 'gaming_reversal' rows (see 4.5)
source          VARCHAR(32) NOT NULL,   -- 'x_scraper','tg_scraper','app_webhook',
-- 'admin','quest','migration','referral_sweep'
source_ref      VARCHAR(256) NULL,      -- tweet id / tx hash / submission id / reversed
-- event id (dedupe + audit key)
awarded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
UNIQUE KEY uq_dedupe (event_type, source_ref),  -- one award per real-world action
INDEX idx_app_time (application_id, awarded_at) -- powers Lifetime + 30-Day sums
);
The UNIQUE KEY on (event_type, source_ref) is the idempotency guarantee: if the scraper sees the same tweet twice, the second insert is rejected and no double XP is awarded. Every ingestion path MUST supply a stable source_ref.
4.5 Gaming reversal — the one allowed exception to “only goes up”
Lifetime XP never decreases — with exactly one exception: confirmed gaming or collusion. Like an airline clawing back fraudulently earned miles, the program can remove XP that was earned by farming. This is implemented as a correction, not as decay, and it is deliberately narrow.
How gaming XP is removed
It is NOT an edit to the lifetime_xp value. It is a new ledger row: event_type = 'gaming_reversal', source = 'admin', xp_amount NEGATIVE, source_ref pointing at the specific original event(s) being reversed. Because Lifetime XP is the SUM of the ledger, the balance drops automatically.
Nothing is deleted. The original earn row and the reversal both remain — a permanent, auditable trail of exactly what was removed, by whom, and why. If the reversal was a mistake, it is itself reversible.
Reversal is ADMIN-ONLY. No automatic process removes XP. The fraud detector FLAGS; a human DECIDES. Automatic removal risks a false positive silently punishing a real ambassador.
Reversal targets the flagged events, not a round-number penalty. “Remove the XP from these 28 collusion replies” — not “dock them 5,000.” Tied to specific rows, it is defensible.
This makes the Part 2 rule precise: Lifetime XP never decreases EXCEPT for a confirmed-gaming reversal, applied as a logged admin event. Retroactive removal is a deterrent and a cleanup tool — it is a complement to the preventive controls (authenticity weighting, cluster detection, the engagement-not-the-reply structure), not a replacement for them. Prevention catches most gaming at ingestion; detection flags the rest; reversal cleans up what slipped through.
4.6 Derived quantities
lifetime_xp(app)  = SELECT COALESCE(SUM(xp_amount),0)
FROM xp_events WHERE application_id = app;
xp_30day(app)     = SELECT COALESCE(SUM(xp_amount),0)
FROM xp_events
WHERE application_id = app
AND awarded_at >= NOW() - INTERVAL 30 DAY;
xp_90day(app)     = same, INTERVAL 90 DAY  -- used for tier requalification
For performance, cache lifetime_xp, xp_30day, xp_90day as columns on the ambassador row, recomputed by the daily cron (Part 7). The ledger remains the source of truth; the cached columns are an optimisation and can always be rebuilt from the ledger.
4.7 What is explicitly NOT in this engine
No 0–100 score. No C1–C11 components. No component weights.
No decay applied to Lifetime XP — ever. The only event that can lower Lifetime XP is an admin gaming-reversal (4.5); ordinary inactivity never does.
No daily-earn formula — XP comes only from the action ledger. (The legacy floor((totalXP/100)^0.8 × 50) formula is deleted.)
5. Migration — Carrying Existing Ambassadors Across
Existing ambassadors have XP today. They keep it. The migration is a controlled cut-over, run once.
5.1 Principle
Freeze and carry — nobody is reset
Each existing ambassador’s current XP balance is read once, at cut-over, and written into the new ledger as a single opening-balance event.
From that moment, all new XP accrues as per-action events on top of the opening balance.
The leaderboard never resets, never blinks. The earliest, most loyal ambassadors lose nothing.
5.2 The migration procedure
Freeze writes to the legacy scoring path (put the legacy recalc cron in maintenance) — the scrapers keep running and keep filling raw activity tables; only scoring is paused.
For every ambassador, read their current legacy balance (the value the live leaderboard shows today).
Insert one row into xp_events per ambassador: event_type = 'migration_opening_balance', xp_amount = that balance, source = 'migration', source_ref = 'migration-' + application_id (so it is unique and idempotent — re-running the migration cannot double it).
Deploy the new engine schema (Part 4) and the new daily cron (Part 7).
Run the new cron once to populate cached lifetime_xp / xp_30day / xp_90day and resolve every ambassador’s tier.
Verify: each ambassador’s new lifetime_xp equals their pre-migration balance (no new actions yet). Spot-check the top 20 and a random 20.
Decommission the legacy scoring code paths (C1–C11, totalXP, decay, the daily formula). Leave scrapers and raw tables fully intact.
5.3 What is NOT migrated
The legacy 0–100 score itself is not carried — only the accumulated balance is. There is no attempt to replay historical raw activity through the new earn values: scrape history is shallow and a fair replay is impossible. The opening-balance event is the clean, honest carry. New per-action XP starts from cut-over forward.
6. Tiers & Requalification
Four requalifying AI tiers, plus the founding designation (Part 8). Tier gates AI Studio access (Part 9) and Perks Vault depth (Part 10).
6.1 The four tiers
Tier
Requalification (trailing 90-day XP)
Unlocks
Target share of active members
Initiate
Automatic on reaching L1. No window requirement.
AI Studio: text only, free models. Perks: entry.
100% (everyone starts here)
Active
≥ 1,200 XP earned in the trailing 90 days.
Adds image generation, reference upload, better text.
~55–65%
Champion
≥ 2,700 XP earned in the trailing 90 days.
Adds video (budget model), near-frontier text & image.
~25–35%
Elite
≥ 3,600 XP in trailing 90 days AND ≥ 90 days since L1.
Adds 1080p video, frontier text & image, higher ceilings.
~8–12%
6.2 How the thresholds were derived
From the earn values in Part 4, a realistic active ambassador earns roughly 2,000 XP per month; a strong one more, a light one less. Over a 90-day window: a light-but-real ambassador clears ~1,200 (Active should be an easy activation hook); a regular, consistent ambassador clears ~2,700 (Champion should feel earned); a near-daily contributor clears ~3,600 (Elite, plus a 90-day tenure floor so it cannot be reached in one burst by a brand-new account).
6.3 Step-down rule
Tier is recomputed daily from the trailing-90-day XP. If the window total falls below the floor of the current tier, the tier steps DOWN by exactly one band — never more than one band per recomputation — after a 14-day grace period. Grace prevents one quiet fortnight from costing a tier; re-crossing the threshold during grace cancels the step-down silently. Step-down is communicated as “your [tier] access pauses in 14 days unless you post — your Lifetime XP and record are untouched.” It is never framed as loss of the banked balance, because the balance is not lost.
6.4 Schema for tier
ALTER TABLE ambassador_applications
ADD COLUMN lifetime_xp       BIGINT UNSIGNED NOT NULL DEFAULT 0,  -- cached sum
ADD COLUMN xp_30day          INT UNSIGNED    NOT NULL DEFAULT 0,  -- cached window
ADD COLUMN xp_90day          INT UNSIGNED    NOT NULL DEFAULT 0,  -- cached window
ADD COLUMN current_tier      ENUM('initiate','active','champion','elite')
NOT NULL DEFAULT 'initiate',
ADD COLUMN tier_step_down_at TIMESTAMP NULL,    -- grace deadline; null if not pending
ADD COLUMN is_founding       TINYINT(1) NOT NULL DEFAULT 0;  -- Part 8
-- NOTE: audit the live schema first. If any of these columns already
-- exist from the legacy system, reconcile names — do NOT blind-run a
-- duplicate ADD COLUMN (it errors, or silently shadows the real column).
7. The Daily Cron — Order of Operations
One daily job, run after the scrapers have finished their pass. Per ambassador, in this exact order. The job must be idempotent — running it twice in one day changes nothing.
Ingest: for each new raw activity row the scrapers wrote since the last run, map it to an XP event and INSERT into xp_events with a stable source_ref. The UNIQUE (event_type, source_ref) key absorbs any duplicate silently.
Recompute cached lifetime_xp = SUM(xp_events.xp_amount) for the ambassador.
Recompute cached xp_30day and xp_90day from the ledger windows.
Resolve target tier from xp_90day (Part 6.1).
If target tier > current tier: promote immediately; clear tier_step_down_at; call the AI tier-sync up (Part 9.5).
If target tier < current tier: if tier_step_down_at is null, set it to now()+14 days and notify the ambassador. If the grace deadline has already passed, apply a one-band step-down, clear tier_step_down_at, call the AI tier-sync down.
If target tier ≥ current tier while a step-down was pending: clear tier_step_down_at silently (the ambassador recovered).
Update the founding-tier collective counter and run the founding closure check (Part 8).
If the ambassador holds the Evangelist badge (is_evangelist = 1) and current_tier has fallen below Champion: start or continue the 14-day Evangelist step-back grace (evangelist_step_back_at), mirroring the tier step-down logic (Part 8A.3). If the grace deadline has passed, clear is_evangelist and notify. If the tier has recovered to Champion+, clear evangelist_step_back_at silently.
On the 1st of the month only: run any monthly recognitions and reset the monthly Spark allowances (Part 9).
Weekly job (separate from the daily cron):
Once a week, the admin runs the community-referral sweep (Part 4.3): read new Telegram-joiner tags, match each to a referrer’s code, and write one community_referral XP event per confirmed referral. This is a manual admin action, not part of the automated daily cron; the /refer bot command that would automate it is a later upgrade. The anti-farming cluster-detection pass (the precondition for the growth-mechanic XP, Part 4.2) also runs here — flagging suspicious A2A and showcase-reply clusters for admin review, which may result in a gaming-reversal (Part 4.5).
Idempotency is mandatory
Every step above must be safe to run twice. The ledger UNIQUE key handles ingestion. Tier resolution is a pure function of xp_90day. The cached sums are derived. Nothing in this cron writes a value it cannot recompute.
8. The Founding Tier
The founding tier is the permanent founding-member designation of the the program community. It is not a requalifying tier and not a rank — it is a one-time, lifelong status, like an airline’s founding-member designation. It attaches to whoever holds it regardless of their later tier or level.
8.1 How it closes
Founding-tier parameters — LOCKED
Collective threshold: the founding window closes permanently when the community’s combined Lifetime XP crosses 5,000,000.
Seat cap: 100 members. If 100 qualify before the collective threshold is reached, the window closes early.
Individual eligibility at close: Lifetime XP ≥ 2,000 · account age ≥ 30 days · no fraud/gaming flag · Telegram auth verified · final YourProtocol-team confirmation.
Once closed, the founding tier can never be earned again. The collective counter is public and updated daily.
8.2 The pacing math — shown so it can be defended and re-tuned
A realistic active ambassador earns ~2,000 XP/month (blended: ~60% light at ~600, ~30% medium at ~3,000, ~10% heavy at ~8,000). Community monthly accrual = active count × ~2,000. Time for the 5,000,000 collective threshold to close, by active count:
Active ambassadors
Community XP / month
5,000,000 closes in
100
~200,000
~25 months
150
~300,000
~17 months
200
~400,000
~12–13 months
300
~600,000
~8 months
400
~800,000
~6 months
At the realistic first-year ramp (~200 active) the window closes in roughly a year; if the community grows faster it closes sooner. 5,000,000 is therefore a deliberately inclusive, year-one founding window — most ambassadors who join and genuinely contribute during the first year get a real shot at one of the 100 seats. The trade is urgency: this is a year-long climb, not a sprint. This is a chosen, locked parameter.
DECISION OWNER — verify before publishing
The pacing depends on the real active-ambassador count. Pull it from the database: COUNT of ambassadors at L1+ active within the activity window. Do this before the 5,000,000 figure is published anywhere.
Once the collective counter is shown publicly it is a fixed commitment and must not move. Verify, then publish — not the other way round.
8.3 Schema for the founding tier
CREATE TABLE founding_config (
id                  INT PRIMARY KEY DEFAULT 1,
collective_threshold BIGINT NOT NULL DEFAULT 5000000,
seat_cap            INT    NOT NULL DEFAULT 100,
individual_floor    INT    NOT NULL DEFAULT 2000,
closed_at           TIMESTAMP NULL,         -- set once, when window closes
seats_filled        INT NOT NULL DEFAULT 0
);
-- is_founding flag lives on ambassador_applications (Part 6.4).
-- Closure check (in the daily cron): if closed_at IS NULL and
-- ( SUM(lifetime_xp) >= collective_threshold OR seats_filled >= seat_cap )
-- then award is_founding=1 to all currently-eligible ambassadors,
-- set closed_at = NOW(), and freeze.
8A. The Evangelist Track
Evangelist is a parallel honour that runs alongside the tier and level systems — it is not part of either ladder. It exists in the live program today and is carried forward unchanged in concept; only its maintenance condition is re-pointed at the new XP engine. Where the Founding tier is an automatic XP milestone, Evangelist is a curated selection: the the program team hand-picks who carries it.
8A.1 What Evangelist is
Property
Definition
Nature
A standard, not a title. It is awarded by the the program team to ambassadors who carry the protocol at the highest level. It is a parallel track — it can attach to an ambassador at any program level (L1–L5) and at any AI tier.
Seats
12 slots. Deliberately scarce. This is unchanged from the live program.
Selection
Hand-picked by the the program team. Not XP-gated, not automatic — a human selection. XP and tier inform the decision; they do not dictate it.
The reward
Evangelists represent the protocol at the program summit — flight, accommodation, and expenses covered. The ambassadors who hold the badge in the qualifying month travel. This is the program’s flagship concrete reward and it is unchanged.
The badge
Visually distinct, gold-toned, displayed on the leaderboard and the public profile. It is one of the existing 14 badges (Part 10.2) and stays in the set.
8A.2 Evangelist vs the Founding tier — do not conflate them
Two different mechanisms, two different axes
Founding tier (Part 8): XP-gated, 100 seats, automatic. Hit the bar — you are in. It is a milestone, earned by contribution volume, and once closed it is permanent and never re-opens.
Evangelist (this Part): team-selected, 12 seats, curated. It is an honour, granted by judgement, and it can step back and be re-awarded.
They sit on different axes and do not compete. An ambassador can hold both, either, or neither. Founding answers ‘did you contribute enough, early enough’; Evangelist answers ‘does the team trust you to represent the protocol in the room.’
8A.3 Maintenance — re-pointed at the new engine
The live program maintained Evangelist on the old 0–100 consistency score (“consistency block at 15/30 or above, measured daily; 14 days below floor steps the badge back”). That formula belongs to the deleted legacy engine and cannot survive. The Evangelist concept is unchanged; its measurement is re-pointed:
To hold the Evangelist badge, an ambassador must maintain at least Champion tier (Part 6) — i.e. keep requalifying on the trailing-90-day XP window. Champion is the floor; Elite holds it comfortably.
If the ambassador’s tier lapses below Champion, the Evangelist badge steps back — after the same 14-day grace the tier system already uses (Part 6.3). A private message is sent, exactly as the live program does.
The badge can be restored. If the ambassador climbs back to Champion and the team still endorses them, Evangelist returns. The live program’s principle — “drop below the standard and the badge steps back; come back strong and it returns; the door is never closed” — is preserved verbatim in spirit.
Stepping back is a badge-and-honour event only. It never touches Lifetime XP and never touches the banked record — consistent with the Part 2 rule. Losing Evangelist is losing a standard, not losing miles.
Selection and re-award remain a YourProtocol-team decision. The tier floor is a necessary condition, not a sufficient one: reaching Champion makes an ambassador eligible to be considered; it does not auto-grant the badge. The 12 seats are filled by the team.
8A.4 Schema for Evangelist
ALTER TABLE ambassador_applications
ADD COLUMN is_evangelist        TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN evangelist_granted_at TIMESTAMP NULL,
ADD COLUMN evangelist_step_back_at TIMESTAMP NULL; -- grace deadline; null if not pending
-- Evangelist is set and cleared by ADMIN action (team selection), never by the cron.
-- The daily cron only does ONE thing for Evangelist: if is_evangelist = 1 and the
-- ambassador's current_tier has fallen below 'champion', start/track the 14-day
-- step-back grace (evangelist_step_back_at), mirroring the tier step-down logic.
-- 12-seat cap is enforced at the point of admin granting, not in the cron.
9. The AI Creator Studio
The Studio is the headline reward and the working tool. Access is gated by current tier. The architecture below is final; the specific model names and prices in Part 9.3 are the only [VERIFY] items in this document.
9.1 Architecture
Ambassador  (sk-your-key-xxxx  ->  YOUR_API_DOMAIN/v1)
--->  TEXT          ->  LiteLLM Proxy  ->  text providers
'--->  IMAGE + VIDEO ->  MediaRouter    ->  image/video providers
One sk-your- key per ambassador, one base URL. Behind it: LiteLLM handles text (OpenAI-shaped, streaming, virtual keys, budgets). A thin MediaRouter handles image and video (async submit/poll job pattern; provider surfaces too varied to normalise through LiteLLM cleanly). The split is invisible to the ambassador — the portal routes /v1/chat/* to LiteLLM and /v1/images/* and /v1/videos/* to the MediaRouter. Deploy LiteLLM + Postgres + Redis on Railway via the official Docker image; MediaRouter on Railway; portal on Vercel; reference uploads to Cloudflare R2.
9.2 Security — mandatory
LiteLLM deployment rule
LiteLLM had a supply-chain compromise in March 2026 — malicious PyPI packages. The official Docker image was not affected (it pins its own dependencies).
Rule: deploy LiteLLM ONLY via the official Docker image; never pip install litellm into the runtime. If pip is ever used anywhere, pin a known-clean version per LiteLLM’s own advisory.
Back up the LiteLLM salt key before first boot — it is immutable after, and losing it makes every stored provider key unreadable.
9.3 The capability tiers — verified provider pricing
The application code never names a model. It names a capability tier — draft / standard / quality / premium. A config file maps each tier to the current best model; rotating models is a config edit, never a code change. The table below is filled from first-party provider pricing pages, verified May 2026. The draft/standard rows are first-party confirmed; the premium-tier model NAMES are estimate-grade (this market reprices every 8–12 weeks) and are marked — their tier slots and cost ceilings are final regardless of which exact model fills them.
Modality
Tier
Model (provider)
Unit price
Source / date
Text
draft
Groq Llama 3.1 8B
$0.05 / $0.08 per M tok
groq.com/pricing · May 2026
Text
standard
Groq Llama 3.3 70B
$0.59 / $0.79 per M tok
groq.com/pricing · May 2026
Text
quality
Gemini 2.5 Flash (PAID tier)
$0.30 / $2.50 per M tok
ai.google.dev · May 2026
Text
premium
Gemini 2.5 Pro (paid) — or a current frontier model  — model name estimate-grade
$1.25 / $10 per M tok
ai.google.dev · May 2026
Image
draft
Cloudflare Workers AI — FLUX.1 schnell
~$0.00063 / image
developers.cloudflare.com · May 2026
Image
standard
fal.ai — FLUX.1 dev / FLUX.2 pro
$0.025–$0.03 / image
fal.ai/pricing · May 2026
Image
quality
fal.ai — Seedream V4 / Ideogram V3
$0.03–$0.06 / image
fal.ai/pricing · May 2026
Image
premium
fal.ai — Nano Banana 2 / GPT Image (high)  — model name estimate-grade
$0.08–$0.17 / image
fal.ai/pricing · May 2026
Video
draft
WaveSpeed — Wan 2.2 Ultra Fast 480p
$0.01/s ($0.05 / 5s clip)
wavespeed.ai/pricing · May 2026
Video
standard
fal.ai / WaveSpeed — Kling 2.1 Std 720p
$0.05/s ($0.25 / 5s clip)
fal.ai · wavespeed.ai · May 2026
Video
premium
fal.ai — Veo 3.1 Fast 1080p + audio  — model name estimate-grade
$0.15/s ($0.75 / 5s clip)
fal.ai/pricing · May 2026
Notes carried from the provider research, all build-relevant:
Gemini MUST be the paid tier for any ambassador-facing traffic. Google’s terms confirm free-tier prompts and outputs are used to train Google models and may be read by human reviewers; the paid tier is not used for training. Routing ambassador content through free-tier Gemini leaks their data into Google training — paid tier only.
Groq multi-tenant is explicitly permitted. Groq’s Terms of Sale §1.3 allows making the service available to end users through your application — so the proxy model is ToS-compliant on Groq. Prohibited: reselling raw API access, sharing keys with third parties, or splitting orgs to dodge rate limits (none of which YourProtocol does).
The draft image tier is Cloudflare, not a free endpoint. The previously assumed free FLUX.1-schnell endpoint on Together is dead. Cloudflare runs FLUX.1 schnell at ~$0.00063/image — 4–5× cheaper than fal or Together — and the free 10,000 Neurons/day covers ~173 images/day at zero cost. This is the cheapest draft-image path.
Do NOT route to Cerebras Llama 3.3 70B — it is deprecated as of February 2026. If Cerebras is used as a text fallback, route to its current flagship, not the deprecated model.
Gemini context caching gives ~90% off repeated input tokens. Every ambassador request carries the same system prompt — caching that shared block materially cuts the quality/premium text cost. Enable it.
OpenRouter, if used as a fallback, adds a deposit fee (~5% + $0.35 per credit purchase). Its per-token rates look cheap but the spread makes it a fallback, not a primary route.
Selection criteria, unchanged and still binding: (1) the provider’s ToS permits serving many end-users through one proxy key; (2) for any free tier used, the provider does not train on submitted content — else use the paid tier; (3) lowest cost meeting the quality bar; (4) availability behind the proxy. Re-verify this table quarterly — image and video prices fall 20–40% per quarter and the premium model names will rotate.
Cost reality — video is the only real driver, and it is now smaller than feared
With verified pricing: text is effectively free at any ambassador scale; draft images are ~$0.0006 each; the cost centre is video.
But verified video is cheap at the low tiers: a draft clip is $0.05, a premium 5s Veo 3.1 Fast clip is $0.75. A Champion-tier ambassador generating 20 clips/month is roughly $1–$15, not the runaway figure earlier unverified memos implied.
The call-volume ceiling (9.5) still governs spend — but the numbers it governs are modest. Premium video is the only line worth watching.
9.4 Tier → Studio access
Tier
Text
Image
Video
Initiate
Draft tier model.
Draft image. No reference upload.
None.
Active
Standard tier model.
Standard image. Reference upload enabled.
None.
Champion
Quality tier model.
Quality image.
Video unlocked — draft/budget model, short clips.
Elite
Premium tier model.
Premium image.
1080p video, longer clips, higher ceiling.
9.5 Cost control — call-volume ceilings, not dollar caps
Cost is controlled by a per-tier daily call-volume ceiling enforced in the proxy, not by a dollar budget. A dollar cap produces a hard “out of credits” wall and unpredictable spend; a call-volume ceiling queues gracefully and makes spend predictable. Text and image ceilings are set high enough that a normal ambassador never notices them. The video clip quota is the single deliberate cost lever — video is the only real cost driver — and is enforced hard. At the ceiling, requests queue; the ambassador never sees “out of credits.” Exact daily numbers are set once the verified video price (Part 9.3) and the real active-ambassador count are known.
9.6 Tier-sync — the critical seam
When the daily cron changes an ambassador’s tier, it must immediately reconcile their proxy key’s permitted models and ceilings to the new tier (a /key/update call). This is the one integration point between the XP engine and the Studio. It must be idempotent and fail safe: on any sync error, the key must never be left with access ABOVE the ambassador’s earned tier — default to the lower of (last-known tier, target tier) and retry.
9.7 Reference uploads
Reference images and video start/end frames upload to Cloudflare R2 (zero egress); R2 returns a public URL passed to providers. The MediaRouter normalises the per-provider differences — multipart vs JSON image_url, start-frame vs start+end-frame support — so the ambassador simply “adds a reference.” Async video: submit → receive job id → poll → fetch result; the portal shows a progress state and never blocks.
10. Perks Vault, Badges & Leaderboard
10.1 The Perks Vault
Third-party software deals, branded “Program Perks,” unlocked deeper as tier rises. The NachoNacho option has been researched against first-party sources and the finding changes the recommendation — read the callout before deciding.
VERIFIED — NachoNacho “Tribes” is co-branded, NOT white-label
The original brief assumed ambassadors would see “Program Perks” and never NachoNacho. NachoNacho’s Tribes product does not deliver that.
The storefront widget is brandable (YourProtocol logo, colours). But to REDEEM any perk, the ambassador must create a NachoNacho account, pay via NachoCard, and any cashback lands in their NachoNacho account. The auth, payment and cashback layers are all NachoNacho-native — the ambassador is pushed out of YourProtocol’s branded experience at the redemption step.
There is NO documented revenue share for the Tribe operator on member SaaS purchases. Tribes is positioned as a goodwill/retention tool, not a monetisation product.
Pricing is custom-quote only — no public platform fee, no GMV %, no monthly floor published.
DECISION — the Perks Vault: two options, recommendation sharpened
Option A — Curated static vault: a hand-maintained list of free and discounted creator/developer tools. No backend, no vendor contract, no integration. Ships immediately, zero cost, fully brand-controlled, stays inside your branded UI end to end.
Option B — NachoNacho Tribes: a brandable storefront over NachoNacho’s 800+ SaaS catalogue — but co-branded, not white-label (see above), no operator revenue share, custom-quote pricing.
Recommendation: ship Option A. It is the only option that delivers the “ambassadors see Program Perks” experience the vision asked for. Option B is worth a sales call ONLY if catalogue depth outweighs the broken branding — and even then it is a non-blocking parallel track, never a launch dependency.
Questions still worth asking NachoNacho if Option B is explored: the Tribes price at the program’s community size; whether Tribes and their separate Affiliate program can be stacked so YourProtocol earns on members who upgrade to NachoNacho Premium; whether deeper white-label (custom domain, branded auth) exists at a higher tier; and the contract minimum term.
10.2 Badges
The badge system is legacy and kept. Individual badge conditions that referenced the old C-components are re-pointed at the new XP data: consistency badges read posting-day counts from xp_events; content/community/builder badges read the relevant event_types or remain admin-awarded; knowledge badges read the test score; momentum badges read the trend of xp_30day. The badge engine itself does not change — only the inputs each condition reads.
10.3 Leaderboard
Public and live. Sorted by 30-Day XP by default (who is active now), re-sortable by Lifetime XP (who has built the most). Each profile shows Lifetime XP and tier, 30-Day XP, program level (L1/L2 public), the trend indicator, earned badges, an XP breakdown by activity area, and the founding-member designation if held. The leaderboard query reads the cached xp_30day / lifetime_xp columns — it does not sum the ledger live.
11. Rewards Language — Locked
The ambassador-facing and public language about token or stablecoin rewards is locked to the wording below. It commits to intent and effort, not to a payout, a number, or a date.
Locked rewards language
“We’re committed to making sure our community is always taken care of. Current rewards are support-based — tools, perks, and access — and we’re continuously working on how to bring stablecoin and token rewards and incentives to our most engaged ambassadors as the program grows.”
This wording is used in the program doc and on the public site. The current live XP page language that promises “real stablecoins — spendable, swappable, holdable” must be replaced with the wording above. A settlement company publicly promising stablecoin payouts to its marketing community, denominated and concrete, is a regulatory and trust exposure across every jurisdiction the protocol operates in. Final public wording should be reviewed by your founder with legal input before going live — but the locked internal position is the language above, and the concrete-promise language comes down.
One concrete reward is unaffected by this and stays prominent: the Evangelist the program summit trip (Part 8A). Softening the stablecoin language does not leave the program without a hard, exciting reward — the AI Creator Studio is the everyday reward, and the Evangelist trip is the flagship one. Both are real, both are deliverable, and neither requires a token or payout promise. Keep the the program summit reward visible in ambassador-facing copy.
12. Build Order
#
Step
Precondition / why here
1
Audit the live schema and codebase. Identify the legacy scoring code to remove and confirm which columns already exist.
Prevents duplicate-column migrations and accidental rebuilding of legacy ingestion.
2
Create the xp_events ledger and the new columns on ambassador_applications (Parts 4.3, 6.4).
Foundation for everything.
3
Build the new XP engine: ingestion mapping raw activity → xp_events, and the derived sums (Part 4).
Core mechanic.
4
Run the migration: freeze legacy scoring, write opening-balance events, verify balances carried (Part 5).
Must happen before the new cron goes live.
5
Build the daily cron: ingest, recompute sums, resolve tier, step-down logic, founding closure check (Part 7).
Depends on 2–4.
6
Decommission legacy scoring code (C1–C11, totalXP, decay, daily formula). Leave scrapers and raw tables intact.
Only after 4–5 verified.
7
Update leaderboard and dashboard to show Lifetime XP, 30-Day XP, tier, trend, step-down grace state (Part 10.3).
Ambassadors must see the new numbers.
8
Re-point badge conditions at the new XP data (Part 10.2), including the Evangelist badge maintenance (Part 8A.3) onto the Champion-tier floor. Add the is_evangelist columns and the cron step-back tracking.
Depends on the ledger and tier system.
9
AI provider table (Part 9.3) — verified pricing already in. Re-confirm the premium model names against first-party pages, then write the dated config.
Pricing done; only premium model names need a final check.
10
Deploy LiteLLM (official Docker image) + MediaRouter on Railway; configure per-tier call-volume ceilings (Part 9.5).
AI infrastructure.
11
Wire key issuance on L1 approval and tier-sync into the daily cron, fail-safe to the lower tier (Part 9.6).
Keys issue automatically; access tracks tier.
12
Build the AI Studio portal tab — text first, image second, video third — with R2 reference uploads (Part 9.7).
Highest-effort frontend.
13
Build the Perks Vault as Option A (curated static). Option B (NachoNacho) runs as a separate parallel track if pursued (Part 10.1).
Low effort, no external dependency.
14
Generate per-ambassador referral codes/links and surface them in the dashboard; build the weekly referral-sweep admin tool (Part 4.3).
Required for the community-referral mechanic.
15
Enable the growth-mechanic XP events (A2A amplification, showcase replies) — ONLY after authenticity weighting and cluster-detection are live and tested (Part 4.2 precondition).
Hard gate: these events farm without the detection layer.
16
QA the full flow at every tier, including a forced tier step-down and recovery, a gaming-reversal, and a re-run of the daily cron to confirm idempotency.
Verifies the system behaves in both directions.
13. Open Items — Owner Required
Open item
Type
Resolution
Premium-tier AI model names (Part 9.3)
Research
Pricing verified; re-confirm the premium model NAMES against first-party pages before writing the config.
Real active-ambassador count
Internal
DB query: COUNT at L1+ active in the window. Confirms founding-tier pacing before 5,000,000 is published.
Daily call-volume ceiling numbers (Part 9.5)
Decision
Set once verified video price + active count are known.
Perks Vault: Option A or B (Part 10.1)
Decision
Recommendation: A now, B as a parallel non-blocking track.
Public-site rewards copy (Part 11)
Legal
Replace the concrete stablecoin promise with the locked wording; your founder + legal review.
Legacy schema reconciliation (Part 12 step 1)
Build
Audit before any migration is run.
YOUR PROTOCOL · AMBASSADOR PROGRAM · THE BUILD BIBLE
All XP math (including the three growth-mechanic events), schema, migration, founding-tier and architecture detail is final and build-grade. AI provider pricing is verified first-party (May 2026); only the premium-tier model names remain estimate-grade and are marked.