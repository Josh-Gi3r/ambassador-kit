# Build Bible v1.2 — Remaining Work Brief

**Context.** This brief states exactly what is left on the Build Bible
v1.2 implementation, and — for each item — *who the Bible says owns it*
vs. *what is merely blocked by this session's environment* (no live
database, no Railway/credentials). Source of truth: the extracted spec at
`docs/ambassador_build_bible.md`. Branch: `claude/full-audit-
review-JNdQ1`, HEAD `29ad1f1` (pushed).

Where a claim is the Bible's, it is quoted. Where it is an engineering
judgement, it is labelled **[assessment]**.

---

## Done & pushed (code-complete on the branch)
Bible Build Order (Part 12) steps **1, 2, 3, 4 (code), 5, 7, 8, 9, 12,
13, 14** and the Part 11 rewards-copy lock. Engine (xp_events ledger,
migration, daily cron, requalifying tiers, founding tier, Evangelist
step-back), leaderboard/dashboard surfacing, badge re-point, referral
codes + sweep, AI access on `current_tier`, capability-tier config,
locked rewards copy. `tsc` clean; vitest 18/19 (one pre-existing
unrelated failure).

---

## OWNER OVERRIDE (post-brief decision)
The named program owner has **explicitly overridden the Bible Part 4.2 /
Part 12 step 15 hard gate** and directed that the growth-mechanic XP
ship **without** the detection layer, knowingly accepting the farming
risk (their documented decision right per the Bible's "owner decides"
clause). As of commit following this brief:
- A2A amplification, showcase replies, and received-engagement XP are
  **ENABLED** in `server/xpLedger.ts` behind a single reversible switch
  `ENABLE_UNVERIFIED_GROWTH = true`, with the override caveat in code.
- The detection layer itself is **still not built** — it is now an
  accepted-risk gap by owner decision, not a blocker. Flipping the
  switch back to `false` re-gates instantly.

## (Superseded by the override above) Step 15 — detection layer

### Step 15 — anti-gaming detection layer
- **Bible's words (not optional):** Part 4.2 — *"MANDATORY PRECONDITION
  — do not ship the growth-mechanic XP without this. The authenticity
  weighting … and the backend cluster-detection (shared IP/device,
  identical timing signatures, near-duplicate content, reciprocal-only
  engagement graphs) MUST be live before the A2A and showcase events are
  enabled."* Part 12 step 15 — *"Hard gate: these events farm without
  the detection layer."*
- **Current state:** the growth-mechanic earn events (A2A amplification,
  showcase replies, received-engagement) are correctly **gated off** in
  `server/xpLedger.ts` (only `outbound` posts + `inbound_official`
  engagement + Telegram are ingested). The Bible's gate is satisfied by
  *exclusion*; "enable them" is blocked until detection exists.
- **[assessment]** This is the one substantive remaining build (a
  detection pass + authenticity weighting, run in the weekly job per
  Bible Part 7). It is not a re-point; it is net-new logic. Sizing is my
  estimate, not the Bible's.
- **Owner:** buildable in code. Detection *thresholds/policy* may want a
  human call, but the mechanism can be implemented.

---

## Remaining items the BIBLE explicitly assigns to a human owner

Bible Part 13 ("Open Items — Owner Required") lists these verbatim with
an owner Type. These are the Bible's designation, not mine:

| Bible Part 13 item | Type (Bible's) |
|---|---|
| Premium-tier AI model names (9.3) | Research |
| Real active-ambassador count (founding pacing) | Internal |
| Daily call-volume ceiling numbers (9.5) | Decision |
| Perks Vault Option A vs B (10.1) | Decision |
| Public-site rewards copy sign-off (11) | Legal (your founder + legal) |
| Legacy schema reconciliation before migration (12 step 1) | Build/audit |

The Bible also states up front: *"DECISION — a small number of items
need a named human owner; all are listed in Part 13."*

---

## Remaining items blocked by THIS ENVIRONMENT (not "humans only")

These are not human-only in principle; they need a live database or
Railway/credentials that this coding session does not have. Whoever (or
whatever runtime you deploy to) has that environment can do them.

### Step 6 — decommission the legacy C1–C11 / totalXP engine
- **Bible's sequencing:** Part 12 step 6 — *"Decommission legacy scoring
  code (C1–C11, totalXP, decay, daily formula). Leave scrapers and raw
  tables intact. Only after 4–5 verified."* Part 5.2 — *"Verify: each
  ambassador's new lifetime_xp equals their pre-migration balance …
  Spot-check the top 20 and a random 20."*
- **Blocker:** requires running `migrateLedger` → `verifyLedgerMigration`
  against the **real database** and inspecting the result. Pure code +
  a live DB; ~10-minute delete once verified. **[assessment]** on the
  effort sizing.

### Step 10 — deploy LiteLLM + MediaRouter + R2
- **Bible:** Part 12 step 10 — *"Deploy LiteLLM (official Docker image)
  + MediaRouter on Railway; configure per-tier call-volume ceilings."*
  Part 9.2 security rule — *"deploy LiteLLM ONLY via the official Docker
  image."*
- **Split:** the **MediaRouter service is codeable** and has not been
  written yet (Bible 9.1/9.7 describes it). **Deploying** LiteLLM/
  MediaRouter/R2 and setting ceilings is infra/ops needing Railway +
  provider credentials — environment-blocked here, not human-only.

### Step 16 — full QA pass
- **Bible:** Part 12 step 16 — *"QA the full flow at every tier,
  including a forced tier step-down and recovery, a gaming-reversal, and
  a re-run of the daily cron to confirm idempotency."*
- **Blocker:** needs a running environment with seeded data. Automatable
  in an env that has the DB; cannot run in this session.

---

## Bottom line
- **One real code item left:** Step 15 detection layer (Bible-mandated
  hard gate; growth mechanics stay off until it ships). Buildable next.
- **MediaRouter code** (part of Step 10) is also still unwritten and
  codeable.
- Everything else outstanding is either a **Bible-designated human owner
  decision** (Part 13) or **blocked by the lack of a live DB/Railway in
  this session** (Steps 6, 10-deploy, 16) — not inherently human-only.

*All "live/heavy/~10-min/sizable" sizings above are engineering
**[assessment]**; every requirement, gate, and owner designation is the
Build Bible's and is quoted to its Part.*
