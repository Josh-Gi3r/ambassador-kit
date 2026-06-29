import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BADGES, BADGE_MAP } from "../../../shared/badges";

// ── TYPES ─────────────────────────────────────────────────────────────────────
type LeaderboardEntry = {
  id: number;
  displayHandle: string | null;
  twitterHandle: string | null;
  telegramHandle: string | null;
  avatarUrl: string | null;
  tracks: unknown;
  level: number;
  isEvangelist: number;
  totalScore: number;
  totalXP: number | null;
  lifetimeXp: number | null;
  xp30day: number | null;
  xp90day: number | null;
  currentTier: "initiate" | "active" | "champion" | "elite" | null;
  tierStepDownAt: string | null;
  isFounding: number | null;
  xpTier: "starter" | "active" | "champion" | "elite" | null;
  isSolitaire: number | null;
  xpTrend: number | null;
  scoreTrend: number;
  xpC1: number | null;
  xpC2: number | null;
  xpC3: number | null;
  xpC4: number | null;
  xpC5: number | null;
  xpC6: number | null;
  xpC7: number | null;
  xpC8: number | null;
  xpC9: number | null;
  xpC10: number | null;
  xpC11: number | null;
  status: string;
  activeBadges: string[];
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
// When a higher-tier badge is active, hide its lower-tier counterpart so the
// row doesn't show e.g. both Sharp and Perfect side by side.
const SUPPRESS_LOWER: Record<string, string> = {
  iron_rhythm: "steady_hand",
  community_pillar: "first_responder",
  perfect: "sharp",
  architect: "shipper",
};

function getBadgesForEntry(e: LeaderboardEntry): typeof BADGES {
  const active = new Set(e.activeBadges ?? []);
  for (const [higher, lower] of Object.entries(SUPPRESS_LOWER)) {
    if (active.has(higher)) active.delete(lower);
  }
  const tierRank: Record<string, number> = { gold: 0, silver: 1, bronze: 2, steel: 3 };
  const display = Array.from(active)
    .map((k) => BADGE_MAP[k])
    .filter((b): b is (typeof BADGES)[number] => Boolean(b))
    .sort((a, b) => (tierRank[a.frameTier] ?? 99) - (tierRank[b.frameTier] ?? 99));
  return display.slice(0, 4); // max 4 inline
}

function sanitizeHandle(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "")
    .replace(/^@+/, "")
    .trim();
}
function getHandle(e: LeaderboardEntry): string {
  const raw = e.displayHandle || e.twitterHandle || e.telegramHandle || `Ambassador #${e.id}`;
  const cleaned = sanitizeHandle(raw);
  return cleaned || `Ambassador #${e.id}`;
}
function getInitials(h: string): string {
  return h.replace(/^@/, "").slice(0, 2).toLowerCase();
}
// Lifetime XP is the ranking + headline number (XP v2.0). totalXP (0–100) is
// the daily earn rate, shown as a secondary figure.
function getXP(e: LeaderboardEntry): number {
  return e.lifetimeXp ?? e.totalXP ?? e.totalScore;
}
// 30-Day XP — the Build Bible "who is active now" number (Part 2 / 10.3).
function get30d(e: LeaderboardEntry): number {
  return e.xp30day ?? 0;
}
function fmtXP(n: number): string {
  return Math.round(n).toLocaleString();
}
function getTrend(e: LeaderboardEntry): number {
  return e.xpTrend ?? e.scoreTrend ?? 0;
}
function getTracks(e: LeaderboardEntry): string[] {
  // tracks is a JSON column — coerce defensively so a row that came back as a
  // string still works.
  const raw = e.tracks;
  if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase());
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).toLowerCase());
    } catch {
      // fall through
    }
  }
  return [];
}
function hasTrack(e: LeaderboardEntry, want: string): boolean {
  return getTracks(e).includes(want.toLowerCase());
}

type TierKey = "initiate" | "active" | "champion" | "elite" | "founding";
function getTierKey(e: LeaderboardEntry): TierKey {
  if (Number(e.isFounding ?? 0) === 1) return "founding";
  const k = e.currentTier ?? e.xpTier;
  if (k === "active" || k === "champion" || k === "elite") return k;
  return "initiate";
}
function tierLabel(t: TierKey): string {
  return {
    initiate: "Initiate",
    active: "Active",
    champion: "Champion",
    elite: "Elite",
    founding: "⚡ Founding",
  }[t];
}

// ── MOBILE HOOK ───────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 768,
  );
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── AVATAR ────────────────────────────────────────────────────────────────────
function PaperAvatar({
  entry,
  size = 60,
  big = false,
}: {
  entry: LeaderboardEntry;
  size?: number;
  big?: boolean;
}) {
  const handle = getHandle(entry);
  const [err, setErr] = useState(false);
  const twitterHandle = sanitizeHandle(entry.twitterHandle);
  const pfpUrl = twitterHandle ? `https://unavatar.io/x/${twitterHandle}` : entry.avatarUrl;
  const isEvangelist = entry.isEvangelist === 1;
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          background: big ? "var(--green-brand)" : "var(--paper-2)",
          border: big ? "2px solid var(--green-brand)" : "2px solid var(--line)",
          display: "grid",
          placeItems: "center",
          fontFamily: "'Fraunces', serif",
          fontSize: Math.round(size * 0.42),
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {pfpUrl && !err ? (
          <img
            src={pfpUrl}
            alt={handle}
            onError={() => setErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ userSelect: "none" }}>{getInitials(handle)}</span>
        )}
      </div>
      {isEvangelist && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: Math.max(18, Math.round(size * 0.32)),
            height: Math.max(18, Math.round(size * 0.32)),
            background: "#d6a017",
            color: "#fff",
            borderRadius: "50%",
            border: "2px solid var(--paper)",
            display: "grid",
            placeItems: "center",
            fontSize: Math.max(9, Math.round(size * 0.18)),
            fontWeight: 700,
          }}
        >
          ★
        </span>
      )}
    </div>
  );
}

// ── TIER + TREND PILLS ────────────────────────────────────────────────────────
function TierPill({ tier }: { tier: TierKey }) {
  return (
    <span className={`tier-badge tier-${tier}`}>{tierLabel(tier)}</span>
  );
}
function TrendPill({ trend }: { trend: number }) {
  if (trend > 0) return <span className="trend-pill up">↑ Rising</span>;
  if (trend < 0) return <span className="trend-pill down">↓ Falling</span>;
  return <span className="trend-pill stable">→ Stable</span>;
}

// ── XP BREAKDOWN POPOVER (desktop hover) ──────────────────────────────────────
const COMP_LABELS = [
  "X Post Output",
  "X Posting Spread",
  "X Engagement",
  "Content Quality",
  "TG Participation",
  "Community Value",
  "Builder Output",
  "Builder Depth",
  "Engagement Authenticity",
  "Mission Alignment",
  "Application Quality",
];
const COMP_MAX = [12, 10, 14, 12, 8, 10, 8, 6, 8, 7, 5];

function XPBreakdown({ entry }: { entry: LeaderboardEntry }) {
  const values = [
    entry.xpC1,
    entry.xpC2,
    entry.xpC3,
    entry.xpC4,
    entry.xpC5,
    entry.xpC6,
    entry.xpC7,
    entry.xpC8,
    entry.xpC9,
    entry.xpC10,
    entry.xpC11,
  ];
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
        minWidth: 280,
        boxShadow: "0 18px 36px -16px rgba(20,20,15,0.25)",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--green)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        XP Breakdown · 11 components
      </div>
      {values.map((value, i) => {
        const v = value ?? 0;
        const max = COMP_MAX[i];
        const pct = Math.min(100, (v / max) * 100);
        return (
          <div key={i} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 3,
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--ink-soft)" }}>{COMP_LABELS[i]}</span>
              <span
                className="mono"
                style={{ color: "var(--ink-mute)", fontWeight: 600 }}
              >
                {v.toFixed(1)}/{max}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--paper-2)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--green)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MOBILE BOTTOM SHEET (top 3 + row drill-in) ───────────────────────────────
function MobileBottomSheet({
  entry,
  onClose,
}: {
  entry: LeaderboardEntry;
  onClose: () => void;
}) {
  const handle = getHandle(entry);
  const tier = getTierKey(entry);
  const trend = getTrend(entry);
  const xp = getXP(entry);
  const badges = getBadgesForEntry(entry);
  const values: (number | null)[] = [
    entry.xpC1,
    entry.xpC2,
    entry.xpC3,
    entry.xpC4,
    entry.xpC5,
    entry.xpC6,
    entry.xpC7,
    entry.xpC8,
    entry.xpC9,
    entry.xpC10,
    entry.xpC11,
  ];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,20,15,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 301,
          background: "var(--paper)",
          borderTop: "1px solid var(--line)",
          borderRadius: "16px 16px 0 0",
          padding: "18px 20px 28px",
          maxHeight: "86vh",
          overflowY: "auto",
          animation: "lb-slideUp 0.22s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--line)",
            borderRadius: 2,
            margin: "0 auto 18px",
          }}
        />
        {/* Header */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <PaperAvatar entry={entry} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="serif"
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              @{handle}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--ink-mute)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 4,
                fontWeight: 700,
              }}
            >
              L{entry.level} · {entry.level === 2 ? "Ambassador" : "Contributor"}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              className="serif"
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {fmtXP(xp)}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--ink-mute)",
                letterSpacing: "0.08em",
                marginTop: 4,
                textTransform: "uppercase",
              }}
            >
              Lifetime XP
            </div>
          </div>
        </div>

        {/* Pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TierPill tier={tier} />
          <TrendPill trend={trend} />
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
            }}
          >
            {fmtXP(get30d(entry))} · 30-day
          </span>
        </div>

        {/* XP component breakdown */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--green)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            margin: "16px 0 12px",
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
          }}
        >
          XP Breakdown · 11 components
        </div>
        {values.map((value, i) => {
          const v = value ?? 0;
          const max = COMP_MAX[i];
          const pct = Math.min(100, (v / max) * 100);
          return (
            <div
              key={i}
              className="xp-comp"
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 56px",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderBottom:
                  i === values.length - 1 ? "none" : "1px solid var(--line)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--green)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                C{i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>
                    {COMP_LABELS[i]}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-mute)",
                      fontWeight: 600,
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--paper-2)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "var(--green)",
                    }}
                  />
                </div>
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  textAlign: "right",
                }}
              >
                {v.toFixed(1)}
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--ink-mute)",
                    fontWeight: 500,
                    marginLeft: 2,
                  }}
                >
                  /{max}
                </span>
              </div>
            </div>
          );
        })}

        {/* Badges */}
        {badges.length > 0 && (
          <>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--green)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 700,
                margin: "20px 0 14px",
              }}
            >
              Active badges
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                paddingBottom: 4,
              }}
            >
              {badges.map((b) => (
                <div
                  key={b.key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    width: 70,
                  }}
                >
                  <img
                    src={b.iconNobg}
                    alt={b.name}
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: "contain",
                      filter: "drop-shadow(0 2px 6px rgba(20,20,15,0.15))",
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      textAlign: "center",
                      lineHeight: 1.25,
                    }}
                  >
                    {b.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes lb-slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
}

// ── PODIUM CARD (top 3 — only on desktop in this design) ─────────────────────
function PodiumCard({
  entry,
  rank,
  sortMode,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  sortMode: "lifetime" | "30d";
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const handle = getHandle(entry);
  const tier = getTierKey(entry);
  const trend = getTrend(entry);
  const badges = getBadgesForEntry(entry);
  const isFirst = rank === 1;
  const labels: Record<1 | 2 | 3, string> = {
    1: "★ 1st · Top of leaderboard",
    2: "★ 2nd · Silver",
    3: "★ 3rd · Bronze",
  };
  const primaryNum =
    sortMode === "lifetime" ? getXP(entry) : Math.round(get30d(entry));
  const primaryLabel = sortMode === "lifetime" ? "Lifetime XP" : "30-day XP";
  const secondary =
    sortMode === "lifetime"
      ? `${fmtXP(get30d(entry))} · 30-day XP`
      : `${fmtXP(getXP(entry))} · Lifetime XP`;

  return (
    <div
      className={`podium-card${isFirst ? " first" : ""}`}
      onMouseEnter={() => setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
    >
      {showBreakdown && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            left: 0,
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          <XPBreakdown entry={entry} />
        </div>
      )}

      <div className="rank-label">{labels[rank]}</div>
      <div className="pod-handle-row">
        <PaperAvatar entry={entry} size={isFirst ? 84 : 60} big={isFirst} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pod-handle">@{handle}</div>
          <div className="pod-level">
            L{entry.level} {entry.level === 2 ? "Ambassador" : "Contributor"}
          </div>
        </div>
      </div>
      <div className="pod-xp">
        <div className="pod-xp-num">{fmtXP(primaryNum)}</div>
        <div className="pod-xp-unit">{primaryLabel}</div>
      </div>
      <div className="pod-30day">{secondary}</div>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <TierPill tier={tier} />
        <TrendPill trend={trend} />
      </div>
      <div className="pod-badges">
        {badges.length === 0 ? (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: isFirst ? "rgba(244,239,230,0.6)" : "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            No badges yet
          </span>
        ) : (
          badges.map((b) => (
            <div key={b.key} className="pod-badge" title={b.name}>
              <img src={b.iconNobg} alt={b.name} />
              <span className="name">{b.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── TABLE ROW (rank 4+) ──────────────────────────────────────────────────────
function RankRow({
  entry,
  rank,
  sortMode,
  onSelect,
  isMobile,
}: {
  entry: LeaderboardEntry;
  rank: number;
  sortMode: "lifetime" | "30d";
  onSelect: () => void;
  isMobile: boolean;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const handle = getHandle(entry);
  const tier = getTierKey(entry);
  const trend = getTrend(entry);
  const badges = getBadgesForEntry(entry).slice(0, 4);
  const primary =
    sortMode === "lifetime" ? getXP(entry) : Math.round(get30d(entry));

  return (
    <div
      className="row"
      onMouseEnter={() => !isMobile && setShowBreakdown(true)}
      onMouseLeave={() => !isMobile && setShowBreakdown(false)}
      onClick={onSelect}
    >
      {showBreakdown && !isMobile && (
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: "calc(100% + 6px)",
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          <XPBreakdown entry={entry} />
        </div>
      )}

      <div className="rk">{String(rank).padStart(2, "0")}</div>
      <div className="av">
        <PaperAvatar entry={entry} size={44} />
      </div>
      <div className="who">
        <div className="h">@{handle}</div>
        <div className={`l${entry.level === 2 ? " l2" : ""}`}>
          L{entry.level} · {entry.level === 2 ? "Ambassador" : "Contributor"}
        </div>
      </div>
      <div className="badges">
        {badges.map((b) => (
          <img key={b.key} src={b.iconNobg} alt={b.name} title={b.name} />
        ))}
      </div>
      <div className="xp-col">
        {fmtXP(primary)}
        <small>{sortMode === "lifetime" ? "lifetime" : "30-day"}</small>
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <TierPill tier={tier} />
        <TrendPill trend={trend} />
      </div>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────
function SectionMark({ num, title }: { num: string; title: React.ReactNode }) {
  return (
    <div className="section-mark">
      <span className="num">{num}</span>
      <h2 className="title serif">{title}</h2>
    </div>
  );
}

// ── BADGE DATA ───────────────────────────────────────────────────────────────
const FEATURED_BADGE_KEYS = [
  "evangelist",
  "wordsmith",
  "viral_voice",
  "architect",
  "perfect",
  "rising",
];
const FEATURED_BADGES = FEATURED_BADGE_KEYS.map((k) => BADGE_MAP[k]).filter(
  (b): b is NonNullable<(typeof BADGE_MAP)[string]> => Boolean(b),
);

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Default sort = Lifetime XP (per c1810f4). Toggle to 30-day for "who's
  // active right now". This is the canonical ranking.
  const [sortMode, setSortMode] = useState<"30d" | "lifetime">("lifetime");
  const [trackFilter, setTrackFilter] = useState<
    "all" | "community" | "developer" | "content" | "evangelist"
  >("all");
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(
    null,
  );
  const isMobile = useIsMobile();

  const { data, isLoading } = trpc.ambassador.publicLeaderboard.useQuery();
  const { data: community } = trpc.ambassador.communityProgress.useQuery();
  const { data: featuredPostsRaw = [] } =
    trpc.featuredPosts.publicListAll.useQuery();

  const allEntries: LeaderboardEntry[] = (data ?? []) as LeaderboardEntry[];

  // Apply track filter first (so podium reflects filter), then search, then sort.
  const trackFiltered =
    trackFilter === "all"
      ? allEntries
      : trackFilter === "evangelist"
        ? allEntries.filter((e) => e.isEvangelist === 1)
        : allEntries.filter((e) => hasTrack(e, trackFilter));

  const searched = search.trim()
    ? trackFiltered.filter((e) => {
        const q = search.toLowerCase().replace(/^@/, "");
        return getHandle(e).toLowerCase().includes(q);
      })
    : trackFiltered;

  const filtered =
    sortMode === "lifetime"
      ? [...searched].sort((a, b) => getXP(b) - getXP(a))
      : [...searched].sort((a, b) => get30d(b) - get30d(a));

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  const evangelistCount = allEntries.filter((e) => e.isEvangelist === 1).length;

  // Featured posts — manually curated by admin, sorted by position
  const featuredPosts = (
    featuredPostsRaw as Array<{
      id: number;
      applicationId: number;
      tweetUrl: string;
      caption: string | null;
      position: number;
      tweetText: string | null;
    }>
  ).sort((a, b) => a.position - b.position);

  return (
    <>
      <SiteHeader />
      <style>{`
        /* ── HERO TAGS ── */
        .lb-hero-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
        .lb-hero-tag {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700;
          color: var(--ink-mute); border: 1px solid var(--line);
          padding: 4px 10px; letter-spacing: 0.12em; text-transform: uppercase;
          border-radius: 4px;
        }
        .lb-hero-quote {
          border-left: 2px solid var(--green); padding-left: 22px; margin: 28px 0 32px;
        }
        .lb-hero-quote p { font-size: 18px; line-height: 1.7; color: var(--ink); margin: 0 0 14px; }
        .lb-hero-quote .punch {
          font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--green);
          font-weight: 700; line-height: 1.5; margin: 0;
        }

        /* ── FOUNDING TIER COUNTER ── */
        .founding {
          border: 1px solid #d6a017;
          background: linear-gradient(180deg, rgba(214,160,23,0.06), transparent);
          border-radius: 10px; padding: 22px 26px; margin-bottom: 18px;
        }
        .founding.closed {
          border-color: var(--line);
          background: var(--paper-2);
        }
        .founding-row {
          display: flex; justify-content: space-between; align-items: baseline;
          flex-wrap: wrap; gap: 12px; font-family: 'JetBrains Mono', monospace;
        }
        .founding .total {
          font-size: clamp(15px, 2vw, 17px); font-weight: 700; color: var(--ink);
        }
        .founding .total small { color: var(--ink-soft); font-weight: 500; }
        .founding .status {
          font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #d6a017;
        }
        .founding.closed .status { color: var(--ink-mute); }
        .founding-bar {
          margin-top: 12px; height: 8px; background: var(--paper-2); border-radius: 4px; overflow: hidden;
        }
        .founding-bar > div { height: 100%; background: linear-gradient(90deg, #d6a017, #f0c14b); transition: width .4s; }
        .founding.closed .founding-bar > div { background: var(--ink-mute); }

        /* ── STAT CARDS ── */
        .stat-cards {
          display: flex; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
        }
        .stat-cell {
          flex: 1; padding: 20px 28px;
          border-right: 1px solid var(--line);
        }
        .stat-cell:last-child { border-right: none; }
        @media (max-width: 720px) {
          .stat-cards { flex-direction: column; }
          .stat-cell { border-right: none; border-bottom: 1px solid var(--line); }
          .stat-cell:last-child { border-bottom: none; }
        }
        .stat-cell .lbl {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--ink-mute); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px;
        }
        .stat-cell .val {
          font-family: 'Fraunces', serif; font-size: 32px; font-weight: 500;
          letter-spacing: -0.02em; line-height: 1.1;
        }

        /* ── CONTROLS ── */
        .lb-controls {
          display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 32px 0 16px;
        }
        @media (max-width: 640px) {
          .lb-controls { gap: 10px; margin: 20px 0 14px; }
        }
        .search-in {
          flex: 1; min-width: 240px;
          background: var(--paper); border: 1px solid var(--line);
          color: var(--ink); font-family: 'Inter', sans-serif;
          font-size: 14px; padding: 11px 16px; border-radius: 999px;
          outline: none;
        }
        @media (max-width: 640px) {
          .search-in { width: 100%; min-width: 0; flex-basis: 100%; }
          .count-info { margin-left: 0; }
        }
        .search-in:focus { border-color: var(--ink); }
        .sort-toggle {
          display: flex; gap: 4px; padding: 3px;
          background: var(--paper-2); border-radius: 999px;
          border: 1px solid var(--line);
        }
        .sort-btn {
          padding: 7px 16px; border: none; background: transparent;
          color: var(--ink-soft); cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700;
          border-radius: 999px;
        }
        .sort-btn.active { background: var(--ink); color: var(--paper); }
        .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .filter-pill {
          padding: 7px 14px; border: 1px solid var(--line);
          background: var(--paper); color: var(--ink-soft);
          font-family: 'Inter', sans-serif; font-size: 13px;
          border-radius: 999px; cursor: pointer;
        }
        .filter-pill.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .count-info {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase;
          margin-left: auto;
        }

        /* ── PODIUM ── */
        .podium {
          display: grid; grid-template-columns: 1fr 1.25fr 1fr;
          gap: 18px; align-items: end;
          margin: 32px 0 40px;
        }
        @media (max-width: 960px) { .podium { grid-template-columns: 1fr; } }
        .podium-card {
          background: var(--paper); border: 1px solid var(--line);
          border-radius: 12px; padding: 24px;
          display: flex; flex-direction: column;
          position: relative;
          transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .podium-card:hover { transform: translateY(-2px); border-color: var(--ink); box-shadow: 0 14px 28px -18px rgba(0,0,0,0.2); }
        .podium-card.first {
          background: var(--ink); color: var(--paper); border-color: var(--ink);
          transform: translateY(-12px);
        }
        .podium-card.first:hover { transform: translateY(-14px); }
        .rank-label {
          font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 12px;
          color: var(--ink-mute);
        }
        .podium-card.first .rank-label { color: var(--green-brand); }

        .pod-handle-row {
          display: flex; gap: 14px; align-items: center; margin-bottom: 18px;
        }
        .pod-handle {
          font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500;
          letter-spacing: -0.01em; line-height: 1; margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .podium-card.first .pod-handle { font-size: 28px; }
        .pod-level {
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: var(--ink-mute); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
        }
        .podium-card.first .pod-level { color: rgba(244,239,230,0.7); }

        .pod-xp {
          display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;
        }
        .pod-xp-num {
          font-family: 'Fraunces', serif; font-size: 44px; font-weight: 500;
          letter-spacing: -0.03em; line-height: 1;
        }
        .podium-card.first .pod-xp-num { font-size: 72px; color: var(--green-brand); }
        .pod-xp-unit {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--ink-mute); letter-spacing: 0.06em; text-transform: uppercase;
        }
        .podium-card.first .pod-xp-unit { color: rgba(244,239,230,0.7); }
        .pod-30day {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--ink-mute); margin-bottom: 14px;
        }
        .podium-card.first .pod-30day { color: rgba(244,239,230,0.65); }

        .pod-badges {
          margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line);
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .podium-card.first .pod-badges { border-top-color: rgba(255,255,255,0.12); }
        .pod-badge {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          width: 52px;
        }
        .pod-badge img {
          width: 44px; height: 44px; object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
        }
        .pod-badge .name {
          font-family: 'JetBrains Mono', monospace; font-size: 8px;
          color: var(--ink-mute); letter-spacing: 0.05em; text-transform: uppercase;
          text-align: center; line-height: 1.2;
        }
        .podium-card.first .pod-badge .name { color: rgba(244,239,230,0.7); }

        /* ── TIER + TREND PILLS ── */
        .tier-badge {
          display: inline-block;
          padding: 3px 8px;
          border: 1px solid currentColor;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          margin-right: 6px;
        }
        .tier-initiate { color: var(--ink-mute); }
        .tier-active   { color: var(--green); }
        .tier-champion { color: #4d80d0; }
        .tier-elite    { color: #b58e1d; }
        .tier-founding {
          color: #d6a017; background: rgba(214,160,23,0.1); border-color: #d6a017;
        }
        .podium-card.first .tier-active { color: var(--green-brand); }
        .podium-card.first .tier-initiate { color: rgba(244,239,230,0.7); }
        .podium-card.first .tier-champion { color: #93b5ec; }

        .trend-pill {
          display: inline-block; padding: 3px 8px;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em;
        }
        .trend-pill.up { color: var(--green); background: rgba(0,200,134,0.1); }
        .trend-pill.stable { color: var(--ink-mute); background: var(--paper-2); }
        .trend-pill.down { color: #c14b3a; background: rgba(193,75,58,0.08); }
        .podium-card.first .trend-pill.stable { color: rgba(244,239,230,0.7); background: rgba(255,255,255,0.08); }

        /* ── TABLE ── */
        .table-wrap {
          background: var(--paper); border: 1px solid var(--line);
          border-radius: 12px; overflow: visible;
          position: relative;
        }
        .table-wrap > .row:first-child { border-radius: 12px 12px 0 0; }
        .table-wrap > .row:last-child { border-radius: 0 0 12px 12px; border-bottom: none; }
        .row {
          display: grid;
          grid-template-columns: 36px 64px 1.4fr auto auto auto;
          gap: 14px; align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--line);
          cursor: pointer; transition: background .12s;
          position: relative;
        }
        .row:hover { background: var(--paper-2); }
        .row:last-child { border-bottom: none; }
        .row .rk {
          font-family: 'JetBrains Mono', monospace; font-size: 14px;
          color: var(--ink-mute); font-weight: 600;
        }
        .row .av {
          display: flex; align-items: center; justify-content: center;
        }
        .row .who { min-width: 0; }
        .row .who .h {
          font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500;
          letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row .who .l {
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: var(--ink-mute); letter-spacing: 0.08em; text-transform: uppercase;
          margin-top: 2px; font-weight: 700;
        }
        .row .who .l.l2 { color: var(--green); }
        .row .badges {
          display: flex; gap: 8px; flex-shrink: 0;
        }
        .row .badges img {
          width: 32px; height: 32px; object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
        }
        .row .xp-col {
          text-align: right;
          font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500;
          letter-spacing: -0.02em; line-height: 1; min-width: 80px;
        }
        .row .xp-col small {
          display: block;
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          color: var(--ink-mute); letter-spacing: 0.06em; text-transform: uppercase;
          margin-top: 3px; font-weight: 600;
        }
        /* iPad mini & small-laptop portrait — keep avatars + xp, drop badges */
        @media (max-width: 880px) {
          .row { grid-template-columns: 28px 52px 1fr auto auto; gap: 12px; }
          .row .badges { display: none; }
          .row .who .h { font-size: 17px; }
          .row .xp-col { font-size: 20px; min-width: 70px; }
        }
        /* Phones — keep a smaller avatar (don't hide), tighter padding */
        @media (max-width: 540px) {
          .row {
            grid-template-columns: 24px 36px 1fr auto;
            padding: 14px 14px; gap: 10px;
          }
          .row .trend-pill { display: none; }
          .row .who .h { font-size: 16px; }
          .row .who .l { font-size: 9px; }
          .row .xp-col { font-size: 18px; min-width: 60px; }
          .row .xp-col small { font-size: 8px; }
        }
        @media (max-width: 380px) {
          .row { grid-template-columns: 22px 1fr auto; }
          .row .av { display: none; }
        }

        /* ── FEATURED POSTS ── */
        .posts-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
        }
        @media (max-width: 720px) { .posts-grid { grid-template-columns: 1fr; } }
        .post-card {
          background: var(--paper); border: 1px solid var(--line);
          border-radius: 12px; padding: 22px;
          text-decoration: none; color: var(--ink);
          transition: border-color .15s, transform .15s;
          display: block;
        }
        .post-card:hover { transform: translateY(-2px); border-color: var(--ink); }
        .post-head {
          display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
        }
        .post-handle {
          font-family: 'Fraunces', serif; font-size: 17px; font-weight: 500;
        }
        .post-text {
          font-size: 14px; line-height: 1.65; color: var(--ink-soft);
          margin: 0 0 14px;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .post-foot {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--green); letter-spacing: 0.08em; text-transform: uppercase;
          font-weight: 700;
        }

        /* ── FEATURED BADGES ── */
        .fbadges-row {
          display: grid; grid-template-columns: repeat(6, 1fr);
          background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
          overflow: hidden;
        }
        @media (max-width: 960px) { .fbadges-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 540px) { .fbadges-row { grid-template-columns: repeat(2, 1fr); } }
        .fbadge {
          padding: 28px 16px 24px;
          border-right: 1px solid var(--line);
          text-align: center;
          transition: background .15s;
          cursor: pointer;
        }
        .fbadge:hover { background: var(--paper-2); }
        .fbadge:last-child { border-right: none; }
        .fbadge img { width: 90px; height: 90px; object-fit: contain; margin: 0 auto 14px; }
        .fbadge .section {
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          color: var(--ink-mute); letter-spacing: 0.14em; text-transform: uppercase;
          font-weight: 700; margin-bottom: 6px;
        }
        .fbadge .name {
          font-family: 'Fraunces', serif; font-size: 17px; font-weight: 500;
          letter-spacing: -0.01em; margin-bottom: 6px;
        }
        .fbadge .name.gold { color: #b58e1d; }
        .fbadge .name.silver { color: #777; }
        .fbadge .name.bronze { color: #a36430; }
        .fbadge .desc {
          font-size: 12px; color: var(--ink-soft); line-height: 1.5;
        }

        /* ── SECTION MARK ── */
        .section-mark {
          display: flex; align-items: baseline; gap: 14px;
          margin: 64px 0 24px; padding-bottom: 18px;
          border-bottom: 1px solid var(--line);
        }
        .section-mark .num {
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          color: var(--green); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
        }
        .section-mark .title {
          font-family: 'Fraunces', serif; font-size: clamp(22px, 3vw, 32px);
          font-weight: 500; letter-spacing: -0.02em; margin: 0;
        }

        /* ── HOW IT WORKS CARDS ── */
        .hiw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 8px; }
        @media (max-width: 860px) { .hiw-grid { grid-template-columns: 1fr; } }
        .hiw-card {
          background: var(--paper); border: 1px solid var(--line);
          border-radius: 10px; padding: 22px 24px;
        }

        /* ── TIP STRIP ── */
        .tip-strip {
          margin-top: 40px; background: var(--green-brand); color: var(--ink);
          padding: 18px 22px; display: flex; gap: 14px; align-items: flex-start;
          flex-wrap: wrap; border-radius: 8px;
        }
        .tip-strip .tag {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 8px; background: var(--ink); color: var(--green-brand); flex-shrink: 0;
        }
        .tip-strip p { margin: 0; font-size: 14px; line-height: 1.6; }
        .tip-strip strong { font-weight: 700; }

        /* ── EMPTY STATE ── */
        .lb-empty {
          padding: 60px 24px; text-align: center; color: var(--ink-mute);
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
      `}</style>

      {/* ── HERO ── */}
      <section
        className="paper-noise"
        style={{ padding: "64px 0 36px", position: "relative" }}
      >
        <div className="paper-container">
          <div
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--green)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            · YOUR PROTOCOL // Ambassador Program
          </div>

          <div className="lb-hero-tags">
            <span className="lb-hero-tag">Contribution</span>
            <span className="lb-hero-tag">Consistency</span>
            <span className="lb-hero-tag">Visibility</span>
          </div>

          <h1 className="h-display serif">Leaderboard.</h1>

          <div className="lb-hero-quote">
            <p>
              You post about the protocol. You build for it. You show up in the
              community. You bring real people in. The leaderboard tracks all of
              it. Live. Rise through the tiers and unlock the AI Creator
              Studio, the Perks Vault, exclusive access, paid trips to global
              events, and a real path into the team.
            </p>
            <p className="punch">
              Grow your profile. Post. Build. Support each other. Show up.
            </p>
          </div>

          {/* Community Founding-tier counter — the collective clock. */}
          {community &&
            (() => {
              const pct = Math.min(
                100,
                (community.total / community.threshold) * 100,
              );
              const closed = community.closed;
              return (
                <div className={`founding${closed ? " closed" : ""}`}>
                  <div className="founding-row">
                    <div className="total">
                      {fmtXP(community.total)} / {fmtXP(community.threshold)}{" "}
                      Community XP
                      <small>
                        {" "}
                        · {community.seatsFilled} / {community.seatCap} founding
                        seats
                      </small>
                    </div>
                    <div className="status">
                      ⚡ Founding · {closed ? "Closed" : "Open"}
                    </div>
                  </div>
                  <div className="founding-bar">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      lineHeight: 1.55,
                      marginTop: 12,
                    }}
                  >
                    The Founding Tier closes when community XP crosses{" "}
                    {fmtXP(community.threshold)}, or when all{" "}
                    {community.seatCap} founding seats are filled — whichever
                    comes first. Permanent founding-member status. Cannot be
                    earned again after close.
                  </div>
                </div>
              );
            })()}

          {/* Stat cards */}
          <div className="stat-cards">
            <div className="stat-cell">
              <div className="lbl">Evangelist slots</div>
              <div className="val">
                {evangelistCount}{" "}
                <span
                  style={{ fontSize: 16, color: "var(--ink-mute)" }}
                >
                  / 12 filled
                </span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="lbl">Applicants</div>
              <div className="val">600+</div>
            </div>
            <div className="stat-cell">
              <div className="lbl">Approved contributors</div>
              <div className="val">{allEntries.length || "60+"}</div>
            </div>
          </div>

          {/* Controls — search + sort */}
          <div className="lb-controls">
            <input
              type="text"
              className="search-in"
              placeholder="Search by handle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="sort-toggle">
              <button
                className={`sort-btn${sortMode === "lifetime" ? " active" : ""}`}
                onClick={() => setSortMode("lifetime")}
              >
                Lifetime XP
              </button>
              <button
                className={`sort-btn${sortMode === "30d" ? " active" : ""}`}
                onClick={() => setSortMode("30d")}
              >
                30-day XP
              </button>
            </div>
          </div>
          <div className="lb-controls" style={{ marginTop: 0 }}>
            <div className="filter-pills">
              {(
                [
                  ["all", "All tracks"],
                  ["community", "Community"],
                  ["developer", "Developer"],
                  ["content", "Content"],
                  ["evangelist", "★ Evangelists only"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={`filter-pill${trackFilter === k ? " active" : ""}`}
                  onClick={() => setTrackFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="count-info">
              {isLoading
                ? "Loading…"
                : `Showing ${filtered.length} ${filtered.length === 1 ? "ambassador" : "ambassadors"}`}
            </div>
          </div>
        </div>
      </section>

      {/* ── PODIUM ── */}
      {!isLoading && top3.length > 0 && !isMobile && (
        <div className="paper-container">
          <div className="podium">
            {(() => {
              // Visual order: 2nd, 1st, 3rd (so 1st sits in the middle, raised).
              const ordered: [LeaderboardEntry | undefined, 2 | 1 | 3][] = [
                [top3[1], 2],
                [top3[0], 1],
                [top3[2], 3],
              ];
              return ordered.map(([entry, rank]) =>
                entry ? (
                  <PodiumCard
                    key={entry.id}
                    entry={entry}
                    rank={rank}
                    sortMode={sortMode}
                  />
                ) : (
                  <div key={`empty-${rank}`} />
                ),
              );
            })()}
          </div>
        </div>
      )}
      {/* Mobile: top 3 as tappable rows that open the same bottom sheet — keeps
          the dddff08 behaviour of "top 3 → bottom sheet on mobile". */}
      {!isLoading && top3.length > 0 && isMobile && (
        <div
          className="paper-container"
          style={{ paddingTop: 8, paddingBottom: 16 }}
        >
          <div className="table-wrap">
            {top3.map((entry, i) => (
              <RankRow
                key={entry.id}
                entry={entry}
                rank={i + 1}
                sortMode={sortMode}
                onSelect={() => setSelectedEntry(entry)}
                isMobile
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TABLE (rank 4+) ── */}
      <div className="paper-container" style={{ paddingBottom: 32 }}>
        {isLoading ? (
          <div className="lb-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="table-wrap">
            <div className="lb-empty">No matches.</div>
          </div>
        ) : rest.length > 0 ? (
          <>
            <div className="table-wrap">
              {(showAll ? rest : rest.slice(0, 17)).map((entry, i) => (
                <RankRow
                  key={entry.id}
                  entry={entry}
                  rank={i + 4}
                  sortMode={sortMode}
                  onSelect={() => setSelectedEntry(entry)}
                  isMobile={isMobile}
                />
              ))}
            </div>
            {rest.length > 17 && (
              <div style={{ textAlign: "center", marginTop: 18 }}>
                <button
                  className="paper-btn-ghost"
                  onClick={() => setShowAll((s) => !s)}
                  style={{ padding: "12px 28px" }}
                >
                  {showAll
                    ? "Show less ↑"
                    : `Show ${rest.length - 17} more ambassadors ↓`}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── FEATURED POSTS ── */}
      {featuredPosts.length > 0 && (
        <section style={{ background: "var(--paper-2)", padding: "64px 0" }}>
          <div className="paper-container">
            <div
              className="section-mark"
              style={{
                marginTop: 0,
                borderBottomColor: "rgba(0,0,0,0.1)",
              }}
            >
              <span className="num">· Top posts</span>
              <h2 className="title serif">Featured ambassador posts.</h2>
            </div>
            <p
              style={{
                maxWidth: 680,
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
                margin: "0 0 28px",
              }}
            >
              Hand-picked by the team. Quality scores 7+/15. Click through
              to see the original on X.
            </p>
            <div className="posts-grid">
              {featuredPosts.slice(0, 6).map((fpost) => {
                const entry = allEntries.find(
                  (e) => e.id === fpost.applicationId,
                );
                const handle = entry ? getHandle(entry) : "";
                const qualityScore = entry?.xpC4
                  ? Math.round(entry.xpC4)
                  : null;
                return (
                  <a
                    key={fpost.id}
                    className="post-card"
                    href={fpost.tweetUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="post-head">
                      {entry ? (
                        <PaperAvatar entry={entry} size={44} />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "var(--paper-2)",
                            border: "1px solid var(--line)",
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="post-handle">
                          {handle ? `@${handle}` : "Ambassador"}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "var(--ink-mute)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          Featured · #{fpost.position}
                          {qualityScore !== null && qualityScore >= 7
                            ? ` · Quality ${qualityScore}/15`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <p className="post-text">
                      {fpost.caption ||
                        fpost.tweetText ||
                        fpost.tweetUrl}
                    </p>
                    <div className="post-foot">View on X →</div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED BADGES ── */}
      <section style={{ padding: "64px 0" }}>
        <div className="paper-container">
          <div className="section-mark" style={{ marginTop: 0 }}>
            <span className="num">· Badges to earn</span>
            <h2 className="title serif">Six to chase first.</h2>
          </div>
          <p
            style={{
              maxWidth: 680,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--ink-soft)",
              margin: "0 0 28px",
            }}
          >
            Out of fourteen total. These are the ones that move the needle on
            your tier and your visibility.
          </p>
          <div className="fbadges-row">
            {FEATURED_BADGES.map((b) => (
              <div
                key={b.key}
                className="fbadge"
                onClick={() => navigate("/badges")}
              >
                <img src={b.iconNobg} alt={b.name} />
                <div className="section">{b.section}</div>
                <div className={`name ${b.frameTier}`}>{b.name}</div>
                <div className="desc">{b.tooltip}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/badges" className="paper-btn-ghost">
              See all 14 badges →
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: "var(--paper-2)", padding: "64px 0" }}>
        <div className="paper-container">
          <div
            className="section-mark"
            style={{ marginTop: 0, borderBottomColor: "rgba(0,0,0,0.1)" }}
          >
            <span className="num">· How the leaderboard works</span>
            <h2 className="title serif">Live, public, transparent.</h2>
          </div>
          <div className="hiw-grid">
            {[
              {
                num: "01 · Default sort",
                head: "Lifetime XP.",
                body: 'Highest XP = #1. Permanent total, never decreases. Toggle to 30-day for "who\'s active right now".',
              },
              {
                num: "02 · Updates",
                head: "Live, snapshot daily.",
                body: "XP updates continuously as contribution is detected. Your official total is recorded once per day.",
              },
              {
                num: "03 · Trend",
                head: "Rising · Stable · Falling.",
                body: "Compares your last 30 days to the 30 before. Three weeks rising in a row earns the Rising badge.",
              },
            ].map((c) => (
              <div key={c.num} className="hiw-card">
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--green)",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {c.num}
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {c.head}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {c.body}
                </p>
              </div>
            ))}
          </div>

          <div className="tip-strip">
            <span className="tag">XP Tip</span>
            <p>
              <strong>What's the easiest way to earn XP?</strong> Support your
              community. Reply, quote or repost your fellow community members.
              The more you help others grow, the more you grow.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          padding: "64px 0",
          borderTop: "1px solid var(--line)",
          background: "var(--paper-2)",
        }}
      >
        <div
          className="paper-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--green)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Ambassador Program
            </div>
            <h2
              className="serif"
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                margin: 0,
              }}
            >
              The leaderboard{" "}
              <em style={{ color: "var(--green)", fontStyle: "italic" }}>
                is live.
              </em>
              <br />
              <span
                style={{
                  color: "var(--ink-mute)",
                  fontSize: "0.7em",
                }}
              >
                Where will you land?
              </span>
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/xp-system" className="paper-btn-ghost">
              Full XP breakdown →
            </Link>
            <Link href="/apply" className="paper-btn-primary">
              Apply now →
            </Link>
          </div>
        </div>
      </section>

      {/* ── DOC FOOTER STRIP ── */}
      <div style={{ padding: "28px 0", borderTop: "1px solid var(--line)" }}>
        <div
          className="paper-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Doc 05 // Leaderboard · Your Protocol · Ambassador Program · Public
            Reference // Version 4.0
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Settle on the protocol.
          </div>
        </div>
      </div>

      <SiteFooter />

      {/* Mobile drill-in sheet — driven by row/podium click */}
      {selectedEntry && (
        <MobileBottomSheet
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}
