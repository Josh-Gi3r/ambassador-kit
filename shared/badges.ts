// ── AMBASSADOR BADGE DEFINITIONS ────────────────────────────────────────────
// Single source of truth for all badges.
// Used by server automation logic, frontend display, and admin panel.
//
// Badge image paths are relative to VITE_CDN_BASE.
// Set VITE_CDN_BASE in .env (or override iconNobg/iconBg per badge) to
// point at your own CDN or static hosting.

// CDN base is configured via VITE_CDN_BASE environment variable.
// Falls back to empty string — serve badge images from your own CDN/public dir.
const CDN = typeof globalThis?.process !== "undefined"
  ? (process.env.VITE_CDN_BASE ?? "")
  : (typeof import.meta !== "undefined" ? ((import.meta as any).env?.VITE_CDN_BASE ?? "") : "");

export type BadgeStatus = "active" | "dormant" | "locked";
export type BadgeSection = "rank" | "evangelist" | "consistency" | "content" | "builder" | "community" | "knowledge" | "momentum";
export type FrameTier = "steel" | "bronze" | "silver" | "gold";

export interface BadgeDef {
  key: string;
  name: string;
  section: BadgeSection;
  frameTier: FrameTier;
  /** URL to the transparent PNG (no background) — used in leaderboard rows, badge shelf */
  iconNobg: string;
  /** URL to the full badge PNG (with background) — used in badge page grid */
  iconBg: string;
  /** One-line tooltip description */
  tooltip: string;
  /** Full description for the /badges page */
  description: string;
  /** Earn condition text */
  earnCondition: string;
  /** Retention text */
  retention: string;
  /** Whether this badge can go dormant */
  permanent: boolean;
  /** Whether this badge is manual admin-only (Evangelist) */
  manualOnly: boolean;
  /** Rising badge has no grace window */
  noGraceWindow?: boolean;
}

export const BADGES: BadgeDef[] = [
  // ── RANK ──────────────────────────────────────────────────────────────────
  {
    key: "l1_contributor",
    name: "L1 CONTRIBUTOR",
    section: "rank",
    frameTier: "steel",
    iconNobg: `${CDN}/badge_l1_contributor.png`,
    iconBg: `${CDN}/badge_l1_contributor.png`,
    tooltip: "You passed the knowledge test and are an L1 Contributor. The team approves Ambassadors (L2).",
    description: "Rank badges sit next to your name on the leaderboard. They show where you are in the program. L1 CONTRIBUTOR // STEEL TIER. You passed the knowledge test and are an L1 Contributor in the Ambassador Program.",
    earnCondition: "Pass the knowledge test on application. L1 Contributor status is granted automatically.",
    retention: "Permanent. This badge stays as long as you are in the program.",
    permanent: true,
    manualOnly: false,
  },
  {
    key: "l2_ambassador",
    name: "L2 AMBASSADOR",
    section: "rank",
    frameTier: "gold",
    iconNobg: `${CDN}/badge_l2_ambassador.png`,
    iconBg: `${CDN}/badge_l2_ambassador.png`,
    tooltip: "The team approved your application. You are an Ambassador.",
    description: "Rank badges sit next to your name on the leaderboard. They show where you are in the program. L2 AMBASSADOR // GOLD TIER. The team reviewed your application and approved you as an Ambassador.",
    earnCondition: "Approved by the team.",
    retention: "Active as long as your Ambassador status is active.",
    permanent: false,
    manualOnly: false,
  },
  // ── EVANGELIST ────────────────────────────────────────────────────────────
  {
    key: "evangelist",
    name: "EVANGELIST",
    section: "evangelist",
    frameTier: "gold",
    iconNobg: `${CDN}/badge_evangelist.png`,
    iconBg: `${CDN}/badge_evangelist.png`,
    tooltip: "Limited slots. Hand-picked by the program team. Evangelists are hand-picked for the program's annual event.",
    description: "Limited slots. Hand-picked by the program team. Evangelists are hand-picked for the program's annual event. EVANGELIST // GOLD TIER. The team selects 12 ambassadors who will be flown to Token2049 Singapore with flight, hotel, and expenses fully covered.",
    earnCondition: "Awarded by the team. 12 slots for the Token2049 cohort.",
    retention: "Maintained through the Evangelist consistency floor (15/30 on the consistency block, measured daily). Badge steps back if below floor for 14 consecutive days. Can be re-awarded.",
    permanent: false,
    manualOnly: true,
  },
  // ── CONSISTENCY ───────────────────────────────────────────────────────────
  {
    key: "steady_hand",
    name: "STEADY HAND",
    section: "consistency",
    frameTier: "bronze",
    iconNobg: `${CDN}/badge_steady_hand.png`,
    iconBg: `${CDN}/badge_steady_hand.png`,
    tooltip: "You are posting about the protocol on 4-5 days out of every 14 and keeping a real rhythm going.",
    description: "Consistency badges track how often you show up on X. Not one big week. Every week. STEADY HAND // BRONZE TIER. You are posting about the protocol on 4-5 days out of every 14 and keeping a real rhythm going.",
    earnCondition: "X posting spread score of 6 or above (posting on at least 4-5 distinct days in a 14-day window).",
    retention: "Active as long as posting spread stays at 6+. 14-day grace window if it drops below.",
    permanent: false,
    manualOnly: false,
  },
  {
    key: "iron_rhythm",
    name: "IRON RHYTHM",
    section: "consistency",
    frameTier: "silver",
    iconNobg: `${CDN}/badge_iron_rhythm.png`,
    iconBg: `${CDN}/badge_iron_rhythm.png`,
    tooltip: "You are posting 9+ days out of every 14. Almost daily. Most people cannot keep this up.",
    description: "Consistency badges track how often you show up on X. Not one big week. Every week. IRON RHYTHM // SILVER TIER. You are posting 9+ days out of every 14, which is almost daily and most people cannot keep this up.",
    earnCondition: "X posting spread score of 9 or above (posting on 9+ distinct days in a 14-day window).",
    retention: "Active as long as posting spread stays at 9+. 14-day grace window if it drops below.",
    permanent: false,
    manualOnly: false,
  },
  // ── CONTENT ───────────────────────────────────────────────────────────────
  {
    key: "wordsmith",
    name: "WORDSMITH",
    section: "content",
    frameTier: "bronze",
    iconNobg: `${CDN}/badge_wordsmith.png`,
    iconBg: `${CDN}/badge_wordsmith.png`,
    tooltip: "You are writing posts that actually teach people something about the protocol, and the team has noticed.",
    description: "Content badges reward what you create. Quality over quantity. One post that teaches beats ten that don't. WORDSMITH // BRONZE TIER. You are writing posts that actually teach people something about the protocol, and the team has noticed.",
    earnCondition: "Content quality score of 7 or above, as reviewed by the team.",
    retention: "Active as long as content quality stays at 7+. Decays if no new quality content is produced (qualitative score declines 25% per week without new activity). 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  {
    key: "viral_voice",
    name: "VIRAL VOICE",
    section: "content",
    frameTier: "silver",
    iconNobg: `${CDN}/badge_viral_voice.png`,
    iconBg: `${CDN}/badge_viral_voice.png`,
    tooltip: "You show up consistently in protocol conversations — replying, quoting, and engaging with what others post.",
    description: "Content badges reward what you create. Quality over quantity. One post that teaches beats ten that don't. VIRAL VOICE // SILVER TIER. You show up consistently in protocol conversations — replying, quoting, and engaging with what others are posting about the protocol.",
    earnCondition: "X engagement score (C3) of 6 or above. Earned by replying, quoting, and reposting protocol-related content in the rolling 14-day window — roughly 12+ interactions.",
    retention: "Active as long as engagement score stays at 6+. Resets each 14-day window based on current engagement. 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  // ── BUILDER ───────────────────────────────────────────────────────────────
  {
    key: "shipper",
    name: "SHIPPER",
    section: "builder",
    frameTier: "bronze",
    iconNobg: `${CDN}/badge_shipper.png`,
    iconBg: `${CDN}/badge_shipper.png`,
    tooltip: "You built something real for the ecosystem and got it out the door.",
    description: "Builder badges go to people who ship real things. Code, tools, integrations, events, articles. SHIPPER // BRONZE TIER. You built something real for the ecosystem and got it out the door.",
    earnCondition: "Builder output score of 4 or above (at least one verified submission contributing meaningful points).",
    retention: "Active as long as builder output stays at 4+. 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  {
    key: "architect",
    name: "ARCHITECT",
    section: "builder",
    frameTier: "gold",
    iconNobg: `${CDN}/badge_architect.png`,
    iconBg: `${CDN}/badge_architect.png`,
    tooltip: "What you shipped is exceptional and other people are already referencing it or building on top of it.",
    description: "Builder badges go to people who ship real things. Code, tools, integrations, events, articles. ARCHITECT // GOLD TIER. What you shipped is exceptional and other people are already referencing it or building on top of it.",
    earnCondition: "Builder depth score of 8 or above, as reviewed by the team.",
    retention: "Active as long as builder depth stays at 8+. Decays if no new builder activity (25% per week). 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  // ── COMMUNITY ─────────────────────────────────────────────────────────────
  {
    key: "first_responder",
    name: "FIRST RESPONDER",
    section: "community",
    frameTier: "bronze",
    iconNobg: `${CDN}/badge_first_responder.png`,
    iconBg: `${CDN}/badge_first_responder.png`,
    tooltip: "You are the one answering questions in Telegram before anyone else and helping newcomers find their footing.",
    description: "Community badges go to the people who make the protocol's channels actually useful. FIRST RESPONDER // BRONZE TIER. You are the one answering questions in Telegram before anyone else and helping newcomers find their footing.",
    earnCondition: "Community value score of 7 or above, as reviewed by the team.",
    retention: "Active as long as community value stays at 7+. Decays if no meaningful community activity (25% per week). 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  {
    key: "community_pillar",
    name: "COMMUNITY PILLAR",
    section: "community",
    frameTier: "silver",
    iconNobg: `${CDN}/badge_community_pillar.png`,
    iconBg: `${CDN}/badge_community_pillar.png`,
    tooltip: "Other ambassadors actively come to you for answers because you know the product and you know how to explain it.",
    description: "Community badges go to the people who make the protocol's channels actually useful. COMMUNITY PILLAR // SILVER TIER. Other ambassadors actively come to you for answers because you know the product and you know how to explain it.",
    earnCondition: "Community value score of 9 or above, as reviewed by the team.",
    retention: "Active as long as community value stays at 9+. Decays if no meaningful community activity (25% per week). 14-day grace window before going dormant.",
    permanent: false,
    manualOnly: false,
  },
  // ── KNOWLEDGE ─────────────────────────────────────────────────────────────
  {
    key: "sharp",
    name: "SHARP",
    section: "knowledge",
    frameTier: "steel",
    iconNobg: `${CDN}/badge_sharp.png`,
    iconBg: `${CDN}/badge_sharp.png`,
    tooltip: "You scored 8 or higher on the knowledge test, which means you came in already understanding the protocol.",
    description: "Knowledge badges are earned once, at application time. They reflect how well you understood the protocol before you joined. SHARP // STEEL TIER. You scored 8 or higher on the knowledge test, which means you came in already understanding the protocol.",
    earnCondition: "Knowledge test score of 8 or above.",
    retention: "Permanent. Earned once at application. Cannot go dormant.",
    permanent: true,
    manualOnly: false,
  },
  {
    key: "perfect",
    name: "PERFECT",
    section: "knowledge",
    frameTier: "gold",
    iconNobg: `${CDN}/badge_perfect.png`,
    iconBg: `${CDN}/badge_perfect.png`,
    tooltip: "You got every single question right. 10 out of 10. That almost never happens.",
    description: "Knowledge badges are earned once, at application time. They reflect how well you understood the protocol before you joined. PERFECT // GOLD TIER. You got every single question right. 10 out of 10. That almost never happens.",
    earnCondition: "Knowledge test score of 10/10.",
    retention: "Permanent. Earned once at application. Cannot go dormant.",
    permanent: true,
    manualOnly: false,
  },
  // ── MOMENTUM ──────────────────────────────────────────────────────────────
  {
    key: "rising",
    name: "RISING",
    section: "momentum",
    frameTier: "silver",
    iconNobg: `${CDN}/badge_rising.png`,
    iconBg: `${CDN}/badge_rising.png`,
    tooltip: "Your XP has gone up three weeks in a row and everyone on the leaderboard can see the streak.",
    description: "Momentum badges show that you have been climbing the leaderboard week after week. RISING // SILVER TIER. Your XP has gone up three weeks in a row and everyone on the leaderboard can see the streak.",
    earnCondition: "Trend arrow showing 'rising' for 3 consecutive weekly snapshots.",
    retention: "Active only while the rising trend continues. Goes dormant immediately when trend changes to stable or falling. No grace window. Re-activates when 3 consecutive rising weeks are achieved again.",
    permanent: false,
    manualOnly: false,
    noGraceWindow: true,
  },
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b])
);

// Priority order for leaderboard row display (position 3 = highest-tier achievement badge)
export const BADGE_TIER_PRIORITY: string[] = [
  // Gold frame (highest)
  "perfect", "architect",
  // Silver frame
  "iron_rhythm", "viral_voice", "community_pillar", "rising",
  // Bronze frame
  "steady_hand", "wordsmith", "shipper", "first_responder",
  // Steel frame (lowest)
  "sharp",
];

/** Returns the highest-tier active achievement badge key for a given set of active badge keys */
export function getTopAchievementBadge(activeBadgeKeys: string[]): string | null {
  for (const key of BADGE_TIER_PRIORITY) {
    if (activeBadgeKeys.includes(key)) return key;
  }
  return null;
}

/** Returns the 3 badges to show on a leaderboard row: [rank, evangelist?, topAchievement?] */
export function getLeaderboardRowBadges(activeBadgeKeys: string[]): string[] {
  const result: string[] = [];
  // 1. Rank badge
  if (activeBadgeKeys.includes("l2_ambassador")) result.push("l2_ambassador");
  else if (activeBadgeKeys.includes("l1_contributor")) result.push("l1_contributor");
  // 2. Evangelist
  if (activeBadgeKeys.includes("evangelist")) result.push("evangelist");
  // 3. Highest achievement
  const top = getTopAchievementBadge(
    activeBadgeKeys.filter((k) => k !== "l1_contributor" && k !== "l2_ambassador" && k !== "evangelist")
  );
  if (top) result.push(top);
  return result;
}
