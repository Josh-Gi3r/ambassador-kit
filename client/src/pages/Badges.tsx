import { useState } from "react";
import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Tier = "gold" | "silver" | "bronze" | "steel";
type Badge = {
  key: string;
  name: string;
  section: string;
  tier: Tier;
  icon: string;
  tooltip: string;
  earn: string;
  retention: string;
};

const CDN = (import.meta.env.VITE_CDN_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

const BADGES: Badge[] = [
  {
    key: "l1_contributor",
    name: "L1 Contributor",
    section: "rank",
    tier: "steel",
    icon: `${CDN}/badge_l1_contributor.png`,
    tooltip: "You passed the knowledge test and are an L1 Contributor. The team approves Ambassadors (L2).",
    earn: "Pass the knowledge test on application. L1 Contributor status is granted automatically.",
    retention: "Permanent. This badge stays as long as you are in the program.",
  },
  {
    key: "l2_ambassador",
    name: "L2 Ambassador",
    section: "rank",
    tier: "gold",
    icon: `${CDN}/badge_l2_ambassador.png`,
    tooltip: "The team approved your application. You are an Ambassador.",
    earn: "Approved by the team.",
    retention: "Active as long as your Ambassador status is active.",
  },
  {
    key: "evangelist",
    name: "Evangelist",
    section: "evangelist",
    tier: "gold",
    icon: `${CDN}/badge_evangelist.png`,
    tooltip: "Only 12 slots. Hand-picked by the team. Evangelists get flown out to represent the protocol at major industry events.",
    earn: "Awarded by the team. 12 slots per cohort.",
    retention: "Maintained through the Evangelist consistency floor (15/30 on the consistency block, measured daily). Badge steps back if below floor for 14 consecutive days. Can be re-awarded.",
  },
  {
    key: "steady_hand",
    name: "Steady Hand",
    section: "consistency",
    tier: "bronze",
    icon: `${CDN}/badge_steady_hand.png`,
    tooltip: "You are posting about the protocol on 4-5 days out of every 14 and keeping a real rhythm going.",
    earn: "X posting spread score of 6 or above (posting on at least 4-5 distinct days in a 14-day window).",
    retention: "Active as long as posting spread stays at 6+. 14-day grace window if it drops below.",
  },
  {
    key: "iron_rhythm",
    name: "Iron Rhythm",
    section: "consistency",
    tier: "silver",
    icon: `${CDN}/badge_iron_rhythm.png`,
    tooltip: "You are posting 9+ days out of every 14. Almost daily. Most people cannot keep this up.",
    earn: "X posting spread score of 9 or above (posting on 9+ distinct days in a 14-day window).",
    retention: "Active as long as posting spread stays at 9+. 14-day grace window if it drops below.",
  },
  {
    key: "wordsmith",
    name: "Wordsmith",
    section: "content",
    tier: "bronze",
    icon: `${CDN}/badge_wordsmith.png`,
    tooltip: "You are writing posts that actually teach people something about the protocol, and the team has noticed.",
    earn: "Content quality score of 7 or above, as reviewed by the team.",
    retention: "Active as long as content quality stays at 7+. Decays if no new quality content is produced (qualitative score declines 25% per week without new activity). 14-day grace window before going dormant.",
  },
  {
    key: "viral_voice",
    name: "Viral Voice",
    section: "content",
    tier: "silver",
    icon: `${CDN}/badge_viral_voice.png`,
    tooltip: "You show up consistently in protocol conversations — replying, quoting, and engaging with what others post.",
    earn: "X engagement score (C3) of 6 or above. Earned by replying, quoting, and reposting protocol-related content in the rolling 14-day window — roughly 12+ interactions.",
    retention: "Active as long as engagement score stays at 6+. Resets each 14-day window based on current engagement. 14-day grace window before going dormant.",
  },
  {
    key: "shipper",
    name: "Shipper",
    section: "builder",
    tier: "bronze",
    icon: `${CDN}/badge_shipper.png`,
    tooltip: "You built something real for the protocol ecosystem and got it out the door.",
    earn: "Builder output score of 4 or above (at least one verified submission contributing meaningful points).",
    retention: "Active as long as builder output stays at 4+. 14-day grace window before going dormant.",
  },
  {
    key: "architect",
    name: "Architect",
    section: "builder",
    tier: "gold",
    icon: `${CDN}/badge_architect.png`,
    tooltip: "What you shipped is exceptional and other people are already referencing it or building on top of it.",
    earn: "Builder depth score of 8 or above, as reviewed by the team.",
    retention: "Active as long as builder depth stays at 8+. Decays if no new builder activity (25% per week). 14-day grace window before going dormant.",
  },
  {
    key: "first_responder",
    name: "First Responder",
    section: "community",
    tier: "bronze",
    icon: `${CDN}/badge_first_responder.png`,
    tooltip: "You are the one answering questions in Telegram before anyone else and helping newcomers find their footing.",
    earn: "Community value score of 7 or above, as reviewed by the team.",
    retention: "Active as long as community value stays at 7+. Decays if no meaningful community activity (25% per week). 14-day grace window before going dormant.",
  },
  {
    key: "community_pillar",
    name: "Community Pillar",
    section: "community",
    tier: "silver",
    icon: `${CDN}/badge_community_pillar.png`,
    tooltip: "Other ambassadors actively come to you for answers because you know the protocol and you know how to explain it.",
    earn: "Community value score of 9 or above, as reviewed by the team.",
    retention: "Active as long as community value stays at 9+. Decays if no meaningful community activity (25% per week). 14-day grace window before going dormant.",
  },
  {
    key: "sharp",
    name: "Sharp",
    section: "knowledge",
    tier: "steel",
    icon: `${CDN}/badge_sharp.png`,
    tooltip: "You scored 8 or higher on the knowledge test, which means you came in already understanding the protocol.",
    earn: "Knowledge test score of 8 or above.",
    retention: "Permanent. Earned once at application. Cannot go dormant.",
  },
  {
    key: "perfect",
    name: "Perfect",
    section: "knowledge",
    tier: "gold",
    icon: `${CDN}/badge_perfect.png`,
    tooltip: "You got every single question right. 10 out of 10. That almost never happens.",
    earn: "Knowledge test score of 10/10.",
    retention: "Permanent. Earned once at application. Cannot go dormant.",
  },
  {
    key: "rising",
    name: "Rising",
    section: "momentum",
    tier: "silver",
    icon: `${CDN}/badge_rising.png`,
    tooltip: "Your XP has gone up three weeks in a row and everyone on the leaderboard can see the streak.",
    earn: "Trend arrow showing 'rising' for 3 consecutive weekly snapshots.",
    retention: "Active only while the rising trend continues. Goes dormant immediately when trend changes to stable or falling. No grace window. Re-activates when 3 consecutive rising weeks are achieved again.",
  },
];

const SECTIONS: { key: string; title: string; desc: string }[] = [
  { key: "rank", title: "Rank", desc: "Rank badges sit next to your name on the leaderboard. They show where you are in the program." },
  { key: "evangelist", title: "Evangelist", desc: "Only 12 slots. Hand-picked by the team. Evangelists get flown out to represent the protocol at major industry events." },
  { key: "consistency", title: "Consistency", desc: "Consistency badges track how often you show up on X. Not one big week. Every week." },
  { key: "content", title: "Content", desc: "Content badges reward what you create. Quality over quantity. One post that teaches beats ten that don't." },
  { key: "builder", title: "Builder", desc: "Builder badges go to people who ship real things. Code, tools, integrations, events, articles." },
  { key: "community", title: "Community", desc: "Community badges go to the people who make the protocol's channels actually useful." },
  { key: "knowledge", title: "Knowledge", desc: "Knowledge badges are earned once, at application time. They reflect how well you understood the protocol before you joined." },
  { key: "momentum", title: "Momentum", desc: "Momentum badges show that you have been climbing the leaderboard week after week." },
];

const TIER_NAME_COLOR: Record<Tier, string> = {
  gold: "#b58e1d",
  silver: "#777",
  bronze: "#a36430",
  steel: "var(--ink)",
};

const TIER_MODAL_COLOR: Record<Tier, string> = {
  gold: "#b58e1d",
  silver: "#777",
  bronze: "#a36430",
  steel: "var(--ink-mute)",
};

export default function Badges() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openBadge = openKey ? BADGES.find((b) => b.key === openKey) ?? null : null;

  return (
    <>
      <SiteHeader />
      <style>{`
        .badge-stats {
          display: grid; grid-template-columns: repeat(5, 1fr);
          border: 1px solid var(--line); border-radius: 8px;
          overflow: hidden; background: var(--paper);
        }
        .badge-stat {
          padding: 24px 22px; border-right: 1px solid var(--line);
        }
        .badge-stat:last-child { border-right: none; }
        .badge-stat .num { font-family: 'Fraunces', serif; font-size: 48px; line-height: 1; letter-spacing: -0.03em; font-weight: 500; }
        .badge-stat .lbl { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-mute); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 8px; }
        @media (max-width: 860px) {
          .badge-stats { grid-template-columns: repeat(2, 1fr); }
          .badge-stat { border-bottom: 1px solid var(--line); }
        }

        .section-header {
          display: grid; grid-template-columns: 1fr auto;
          gap: 24px; align-items: end;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
          margin-bottom: 24px;
        }
        @media (max-width: 540px) {
          .section-header { grid-template-columns: 1fr; gap: 8px; align-items: start; }
        }
        .section-header .eyebrow { margin-bottom: 10px; }
        .section-header h3 { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; }
        .section-header p { font-size: 15px; color: var(--ink-soft); line-height: 1.55; max-width: 640px; margin: 0; }
        .section-header .count { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }

        .badge-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        @media (max-width: 720px) { .badge-grid { grid-template-columns: 1fr; } }

        .badge-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 28px 26px;
          display: grid; grid-template-columns: 120px 1fr; gap: 24px;
          align-items: start;
          cursor: pointer;
          transition: border-color .2s, transform .2s, box-shadow .2s;
        }
        .badge-card:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -22px rgba(0,0,0,0.2); }
        .badge-card.gold:hover    { border-color: rgba(212,175,55,0.55); }
        .badge-card.silver:hover  { border-color: rgba(168,168,168,0.55); }
        .badge-card.bronze:hover  { border-color: rgba(205,127,50,0.5); }
        .badge-card.steel:hover   { border-color: var(--ink-mute); }
        .badge-img { width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1)); }
        .badge-name { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; margin: 0 0 6px; }
        .badge-name.gold   { color: #b58e1d; }
        .badge-name.silver { color: #777; }
        .badge-name.bronze { color: #a36430; }
        .badge-name.steel  { color: var(--ink); }
        .badge-tier { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 12px; }
        .badge-tip { font-size: 14px; color: var(--ink-soft); line-height: 1.55; margin: 0; }
        @media (max-width: 540px) {
          .badge-card { grid-template-columns: 80px 1fr; gap: 16px; padding: 20px; }
          .badge-img { width: 80px; height: 80px; }
        }

        .modal-bg {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(20,20,15,0.7); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .modal {
          background: var(--paper); border-radius: 12px;
          max-width: 540px; width: 100%;
          padding: 36px 36px 32px;
          max-height: 90vh; overflow-y: auto;
          position: relative;
        }
        @media (max-width: 540px) {
          .modal-bg { padding: 14px; align-items: flex-end; }
          .modal { padding: 24px 20px 22px; border-radius: 14px 14px 10px 10px; max-height: 86vh; }
        }
        .modal-close {
          position: absolute; top: 18px; right: 18px;
          background: var(--paper-2); border: 1px solid var(--line);
          width: 36px; height: 36px; border-radius: 50%;
          display: grid; place-items: center;
          cursor: pointer; font-size: 16px; color: var(--ink-mute);
        }
        .modal-close:hover { color: var(--ink); border-color: var(--ink); }
      `}</style>

      {/* HERO */}
      <section className="paper-noise" style={{ padding: "clamp(44px, 8vw, 72px) 0 clamp(36px, 6vw, 56px)", position: "relative" }}>
        <div className="paper-container">
          <div className="paper-pill" style={{ marginBottom: 22 }}>
            <span className="paper-dot" /> Your Protocol · Ambassador Program
          </div>
          <h1 className="h-display serif">Badges.</h1>
          <p
            className="lead"
            style={{
              borderLeft: "3px solid var(--green)",
              paddingLeft: 22,
              maxWidth: 700,
              fontSize: 19,
              marginTop: 24,
            }}
          >
            Badges are earned through action. Each one represents a specific kind of contribution to the protocol ecosystem. Some unlock in minutes. Others take weeks of sustained effort. All of them are visible on your profile and on the leaderboard.
          </p>
          <p
            className="mono"
            style={{
              fontSize: 14,
              color: "var(--green)",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginTop: 18,
            }}
          >
            Earn them. Maintain them. Collect them all.
          </p>

          {/* Stats */}
          <div className="badge-stats" style={{ marginTop: 48 }}>
            <div className="badge-stat">
              <div className="num">14</div>
              <div className="lbl">Total badges</div>
            </div>
            <div className="badge-stat">
              <div className="num" style={{ color: "#b58e1d" }}>4</div>
              <div className="lbl">Gold tier</div>
            </div>
            <div className="badge-stat">
              <div className="num" style={{ color: "#888" }}>4</div>
              <div className="lbl">Silver tier</div>
            </div>
            <div className="badge-stat">
              <div className="num" style={{ color: "#a36430" }}>4</div>
              <div className="lbl">Bronze tier</div>
            </div>
            <div className="badge-stat">
              <div className="num">2</div>
              <div className="lbl">Steel tier</div>
            </div>
          </div>
        </div>
      </section>

      <div className="paper-container" style={{ paddingBottom: 100 }}>
        {SECTIONS.map((sec) => {
          const badges = BADGES.filter((b) => b.section === sec.key);
          if (!badges.length) return null;
          return (
            <section key={sec.key} style={{ padding: "clamp(36px, 7vw, 56px) 0 clamp(20px, 4vw, 32px)" }}>
              <div className="section-header">
                <div>
                  <div className="eyebrow">· {sec.title}</div>
                  <p>{sec.desc}</p>
                </div>
                <div className="count">
                  {badges.length} {badges.length === 1 ? "badge" : "badges"}
                </div>
              </div>
              <div className="badge-grid">
                {badges.map((b) => (
                  <div
                    key={b.key}
                    className={`badge-card ${b.tier}`}
                    onClick={() => setOpenKey(b.key)}
                  >
                    <img className="badge-img" src={b.icon} alt={b.name} />
                    <div>
                      <h4
                        className={`badge-name ${b.tier}`}
                        style={{ color: TIER_NAME_COLOR[b.tier] }}
                      >
                        {b.name}
                      </h4>
                      <div className="badge-tier">{b.tier} tier</div>
                      <p className="badge-tip">{b.tooltip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* CTA */}
      <section style={{ background: "var(--ink)", color: "var(--paper)", padding: "clamp(48px, 8vw, 80px) 0", textAlign: "center" }}>
        <div className="paper-container">
          <div className="eyebrow" style={{ color: "var(--green-brand)" }}>· Ambassador Program</div>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: "16px 0 36px",
              color: "var(--paper)",
            }}
          >
            Earn your badges.
            <br />
            <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>Carry the standard.</em>
          </h2>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/leaderboard"
              className="paper-btn-primary"
              style={{ background: "var(--green-brand)", color: "var(--ink)" }}
            >
              View leaderboard ↗
            </Link>
            <Link
              href="/apply"
              className="paper-btn-ghost"
              style={{ borderColor: "rgba(255,255,255,0.4)", color: "var(--paper)" }}
            >
              Apply now ↗
            </Link>
          </div>
        </div>
      </section>

      {/* Modal */}
      {openBadge && (
        <div
          className="modal-bg"
          onClick={() => setOpenKey(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setOpenKey(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <img
                src={openBadge.icon}
                alt={openBadge.name}
                style={{
                  width: 160,
                  height: 160,
                  objectFit: "contain",
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))",
                }}
              />
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                textAlign: "center",
                color: TIER_MODAL_COLOR[openBadge.tier],
              }}
            >
              {openBadge.name}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                textAlign: "center",
                margin: "6px 0 24px",
              }}
            >
              {openBadge.tier} tier
            </div>
            <p
              style={{
                fontSize: 15,
                color: "var(--ink-soft)",
                lineHeight: 1.65,
                margin: "0 0 24px",
              }}
            >
              {openBadge.tooltip}
            </p>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--green)",
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              How to earn
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: "0 0 20px",
              }}
            >
              {openBadge.earn}
            </p>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--green)",
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              Retention
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {openBadge.retention}
            </p>
          </div>
        </div>
      )}

      <SiteFooter />
    </>
  );
}
