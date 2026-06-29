import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Row = { label: string; detail: React.ReactNode };

const OVERVIEW_ROWS: Row[] = [
  { label: "Score range", detail: "Unbounded. XP accumulates like miles — no ceiling." },
  { label: "Direction", detail: "Up only. Earned XP is never removed for inactivity." },
  { label: "Leaderboard", detail: "Live. XP updates as contribution is detected." },
  { label: "Snapshot", detail: "Daily. Your official total is recorded once per day." },
  { label: "Trend", detail: "Compares your last 30 days to the 30 before. Rising, stable, or falling." },
];

const TWO_NUMBER_ROWS: Row[] = [
  { label: "Lifetime XP", detail: "Your permanent total. Every contribution you have ever made, added up. It never decreases. It is your record, and it is what the Founding Tier is measured against." },
  { label: "30-Day XP", detail: "The XP you earned in the last 30 days. It rises and falls with how active you are right now. It is the leaderboard's \"who is showing up today\" sort, and it is what your tier requalifies against." },
];

const CONTENT_ROWS: { label: string; value: string }[] = [
  { label: "Original post about the protocol", value: "+50" },
  { label: "Thread about the protocol (3+ posts)", value: "+150" },
  { label: "Reply to protocol content", value: "+10" },
  { label: "Quote of protocol content", value: "+15" },
  { label: "Repost of protocol content", value: "+5" },
  { label: "Your post receives a repost", value: "+30" },
  { label: "Your post receives a quote", value: "+40" },
  { label: "Your post receives a reply", value: "+20" },
];

const COMMUNITY_ROWS: { label: string; value: string }[] = [
  { label: "Substantive message in protocol channels", value: "+5" },
  { label: "Helping a newcomer (confirmed)", value: "+100" },
  { label: "Hosting a community session", value: "+500" },
  { label: "Representing the protocol at an event", value: "+500" },
];

const BUILDER_ROWS: { label: string; value: string }[] = [
  { label: "Working integration or tool built on the protocol", value: "+2,000" },
  { label: "Open-source repo, protocol-related, functional", value: "+1,500" },
  { label: "Published article or research piece", value: "+1,000" },
  { label: "Tutorial, video, or educational guide", value: "+1,000" },
];

type Principle = { num: string; color: string; title: string; body: string };
const PRINCIPLES: Principle[] = [
  { num: "01", color: "var(--green)", title: "Support your fellow ambassadors.", body: "Reply to, quote, or repost another registered ambassador's protocol content and you earn more than engaging a stranger — and they earn a bonus too. When you lift another ambassador, you both rise. This is the opposite of a zero-sum board." },
  { num: "02", color: "#4d80d0", title: "Showcase the protocol under the big accounts.", body: "A sharp reply that mentions the protocol under a major voice in stablecoins or payments can out-reach an original post. The reply itself earns a little. The real XP comes from the engagement it pulls. A lazy drive-by earns almost nothing. A reply that genuinely shows people what the protocol is earns real XP — the X algorithm decides, not us." },
  { num: "03", color: "#7e5ad1", title: "Bring real people in.", body: "Every ambassador gets a personal referral link in their dashboard. Bring someone into the program community — they join, they follow, they say who sent them — and you earn XP for it. Bring people who go on to contribute themselves and you earn more. Growing the community is contribution." },
];

type Tier = {
  name: string;
  nameColor: string;
  requal: string;
  unlocks: string;
  dark?: boolean;
  borderColor?: string;
};
const TIERS: Tier[] = [
  { name: "INITIATE", nameColor: "var(--ink-mute)", requal: "Automatic at L1", unlocks: "AI Studio: text. Perks Vault: entry." },
  { name: "ACTIVE", nameColor: "var(--green)", requal: "1,200 XP in the last 90 days", unlocks: "Adds image generation and reference upload. Deeper perks.", borderColor: "rgba(0,200,134,0.3)" },
  { name: "CHAMPION", nameColor: "#4d80d0", requal: "2,700 XP in the last 90 days", unlocks: "Adds video generation. Near-frontier text and image.", borderColor: "rgba(77,128,208,0.4)" },
  { name: "ELITE", nameColor: "#FFD700", requal: "3,600 XP in the last 90 days", unlocks: "1080p video, frontier models, the highest limits.", dark: true },
];

const LEADERBOARD_ROWS: Row[] = [
  { label: "Default sort", detail: "30-Day XP. Who is active right now." },
  { label: "Alternate sort", detail: "Lifetime XP. The all-time record." },
  { label: "Update frequency", detail: "Live. XP updates as contribution is detected." },
  { label: "Snapshot", detail: "Daily. Official XP recorded once per day." },
  { label: "Visibility", detail: "Public. Anyone can view it." },
  { label: "Trend indicator", detail: "Rising, stable, or falling. Based on 30-Day vs prior 30-Day." },
  { label: "XP breakdown", detail: "Visible on each ambassador's public profile." },
  { label: "Badges", detail: "Displayed next to each ambassador's name." },
];

const FOUNDING_ROWS: Row[] = [
  { label: "How it closes", detail: "When the community's combined Lifetime XP crosses the founding threshold — or when every founding seat is filled, whichever comes first." },
  { label: "Seats", detail: "100." },
  { label: "Eligibility at close", detail: "A genuine, sustained contribution record and a clean account." },
  { label: "After close", detail: "The Founding Tier can never be earned again." },
];

type Unlock = { accent: string; label: string; body: string; labelColor?: string };
const UNLOCKS: Unlock[] = [
  { accent: "var(--green)", label: "The AI Creator Studio", body: "Your XP tier unlocks a branded AI workspace: text, image, and video generation built into the portal. Initiate starts with text. Active adds image. Champion adds video. Elite runs the best models at the highest limits. The tool you unlock is the tool you use to make the content that earns your next tier." },
  { accent: "#4d80d0", label: "The Perks Vault", body: "Software deals and creator tools, branded Ambassador Perks, unlocked deeper as your tier climbs. The further you go, the more the vault opens." },
  { accent: "#d4af37", labelColor: "#b58e1d", label: "Evangelist Trips", body: "The Evangelist badge sends you to Token2049 Singapore — flight, accommodation, and expenses covered. Twelve slots, hand-picked by the team. Carry the standard and you represent the protocol on the world stage." },
  { accent: "#7e5ad1", label: "Career", body: "The program is the hiring pipeline for every market the protocol enters. Country leads, developer relations, partnerships, business development. The best contributors become the first hires." },
  { accent: "#e88a6c", label: "Rewards — and what is coming", body: "We're committed to making sure our community is always taken care of. Current rewards are support-based — tools, perks, and access — and we're continuously working on how to bring stablecoin and token rewards and incentives to our most engaged ambassadors as the program grows." },
];

type Prin = { num: string; title: string; body: string };
const META_PRINCIPLES: Prin[] = [
  { num: "01", title: "Contribution compounds.", body: "Every action adds to a total that never falls. Months of showing up build something permanent." },
  { num: "02", title: "Community over competition.", body: "Supporting another ambassador earns you both XP. Bringing in new people earns XP. The board is not zero-sum." },
  { num: "03", title: "Recent activity sets your tier.", body: "Lifetime XP is your record. Your tier requalifies on a trailing 90-day window. The two are separate and both matter." },
  { num: "04", title: "No decay, no expiry.", body: "What you earn, you keep. Tiers requalify; balances do not fall." },
  { num: "05", title: "Transparency.", body: "Earn values are published. The leaderboard is public. The founding counter is public. Everything is open." },
  { num: "06", title: "Honest contribution only.", body: "The system is built to reward real work and to remove what is farmed. Contribute honestly and you never have to think about it." },
];

function SectionHeader({ num, title }: { num: string; title: React.ReactNode }) {
  return (
    <>
      <div className="section-num">
        <span className="n">{num}</span>
        <span className="line" />
      </div>
      <h2 className="h-section serif">{title}</h2>
    </>
  );
}

function TableCard({ rows, headers }: { rows: Row[]; headers?: [string, string] }) {
  return (
    <div className="xp-card">
      <table className="xp-table">
        {headers && (
          <thead>
            <tr>
              <th>{headers[0]}</th>
              <th>{headers[1]}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="label">{r.label}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="xp-card">
      <table className="xp-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="xp-val">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function XPSystem() {
  return (
    <>
      <SiteHeader />
      <style>{`
        table.xp-table { width: 100%; border-collapse: collapse; }
        table.xp-table th {
          text-align: left; padding: 12px 16px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-mute);
          letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
          border-bottom: 1px solid var(--line);
        }
        table.xp-table td {
          padding: 14px 16px; vertical-align: top;
          border-bottom: 1px solid var(--line);
          font-size: 15px; color: var(--ink-soft); line-height: 1.55;
        }
        table.xp-table tr:last-child td { border-bottom: none; }
        table.xp-table td.label { font-weight: 600; color: var(--ink); width: 28%; }
        table.xp-table td.xp-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--green); text-align: right; white-space: nowrap; }
        .xp-card { background: var(--paper); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
        .section-num { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .section-num .n { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--green); letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; }
        .section-num .line { flex: 1; height: 1px; background: var(--line); }
        .principle-row {
          display: grid; grid-template-columns: 60px 1fr; gap: 22px;
          padding: 22px 0; border-bottom: 1px solid var(--line);
        }
        .principle-row:last-child { border-bottom: none; }
        .principle-row .num { font-family: 'Fraunces', serif; font-size: 32px; color: var(--green); font-weight: 500; line-height: 1; }
        .principle-row h4 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; margin: 0 0 8px; }
        .principle-row p { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-soft); }
        .callout {
          background: var(--paper-2); border-left: 3px solid var(--green); padding: 22px 26px; border-radius: 0 6px 6px 0;
          margin-top: 22px;
        }
        .callout.warn { border-left-color: #c14b3a; background: rgba(193,75,58,0.06); }
        .callout strong { color: var(--ink); }
        .trend-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
        .trend-pill.up { background: rgba(0,200,134,0.12); color: var(--green); }
        .trend-pill.stable { background: var(--paper-2); color: var(--ink-mute); }
        .trend-pill.down { background: rgba(193,75,58,0.1); color: #c14b3a; }
        .tiers-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 900px) { .tiers-row { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 540px) { .tiers-row { grid-template-columns: 1fr !important; } }
        .trends-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 720px) { .trends-row { grid-template-columns: 1fr !important; } }
        .prin-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
        @media (max-width: 720px) { .prin-row { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px) {
          table.xp-table td.label { width: 40%; }
          .principle-row { grid-template-columns: 1fr; gap: 8px; }
        }
      `}</style>

      {/* HERO */}
      <section className="paper-noise" style={{ padding: "clamp(44px, 8vw, 72px) 0 clamp(32px, 6vw, 48px)", position: "relative" }}>
        <div className="paper-container">
          <div className="paper-pill" style={{ marginBottom: 22 }}>
            <span className="paper-dot" /> Your Protocol · Ambassador Program
          </div>
          <h1 className="h-display serif">
            XP <em style={{ fontStyle: "italic" }}>System.</em>
          </h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0 24px" }}>
            <span className="paper-sticker">Contribution</span>
            <span className="paper-sticker">Consistency</span>
            <span className="paper-sticker">Visibility</span>
          </div>
          <p className="lead">
            XP is the record of what you contribute. It only goes up. The leaderboard is live.
          </p>
        </div>
      </section>

      <div className="paper-container" style={{ paddingBottom: "clamp(64px, 12vw, 120px)" }}>
        {/* 00 OVERVIEW */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="00 // Overview"
            title={<>How XP <em style={{ fontStyle: "italic" }}>works.</em></>}
          />
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 14px" }}>
            XP is the scoring system behind the Ambassador leaderboard. Every ambassador earns XP through contribution — posts about the protocol, community presence, integrations shipped, conversations started, new people brought in. Every contribution adds to your total. Nothing takes it away.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 28px" }}>
            XP is how contribution becomes visible. The leaderboard shows who is showing up.
          </p>
          <TableCard headers={["Label", "Detail"]} rows={OVERVIEW_ROWS} />
        </section>

        {/* 01 TWO NUMBERS */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="01 // The Two Numbers"
            title={<>Lifetime XP and <em style={{ fontStyle: "italic" }}>30-day XP.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 28px" }}>
            The system shows two numbers. They are not the same, and the difference matters.
          </p>
          <TableCard headers={["Number", "What it is"]} rows={TWO_NUMBER_ROWS} />
          <div className="callout">
            Think of it the way airline status works. <strong>Lifetime XP is your miles</strong> — banked, permanent, yours. <strong>Your tier is your status</strong> — re-earned on recent flying. Stop contributing and your tier can step back. Your Lifetime XP does not move. The work you already did stays done.
          </div>
        </section>

        {/* 02 WHAT EARNS XP */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="02 // What Earns XP"
            title={<>Every action has a <em style={{ fontStyle: "italic" }}>fixed value.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 12px" }}>
            There is no single path. Builders earn through code. Creators earn through content. Community operators earn through presence and introductions. Every action has a fixed XP value — no formula, nothing to game, no ceiling.
          </p>
          <p className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 24px" }}>
            Illustrative values — final amounts are set by the team before launch.
          </p>

          <div style={{ marginBottom: 24 }}>
            <div
              className="mono"
              style={{
                fontSize: 13,
                color: "var(--green)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "8px 16px",
                borderLeft: "3px solid var(--green)",
                marginBottom: 10,
              }}
            >
              Content & Advocacy (X)
            </div>
            <ValueTable rows={CONTENT_ROWS} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div
              className="mono"
              style={{
                fontSize: 13,
                color: "#4d80d0",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "8px 16px",
                borderLeft: "3px solid #4d80d0",
                marginBottom: 10,
              }}
            >
              Community (Telegram & real-world)
            </div>
            <ValueTable rows={COMMUNITY_ROWS} />
          </div>

          <div>
            <div
              className="mono"
              style={{
                fontSize: 13,
                color: "#7e5ad1",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "8px 16px",
                borderLeft: "3px solid #7e5ad1",
                marginBottom: 10,
              }}
            >
              Building (reviewed before XP is awarded)
            </div>
            <ValueTable rows={BUILDER_ROWS} />
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-mute)", marginTop: 22, maxWidth: 760 }}>
            Plus on-chain activity in the app, onboarding quests, and team-set quests and Quality Awards. The more dimensions you contribute across, the faster you climb.
          </p>
        </section>

        {/* 03 THREE THINGS WE PUSH HARDEST */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="03 // The Three Things We Push Hardest"
            title={<>Contribution that <em style={{ fontStyle: "italic" }}>grows everyone.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 28px" }}>
            Some contribution is worth more because it grows the whole community, not just your own profile. Three behaviours earn extra.
          </p>
          <div className="xp-card" style={{ padding: 0 }}>
            {PRINCIPLES.map((p) => (
              <div key={p.num} className="principle-row" style={{ padding: "26px 30px" }}>
                <div className="num" style={{ color: p.color }}>{p.num}</div>
                <div>
                  <h4>{p.title}</h4>
                  <p>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 04 TIERS */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="04 // Tiers"
            title={<>Initiate, Active, <em style={{ fontStyle: "italic" }}>Champion, Elite.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 8px" }}>
            Your tier is your contribution status. It unlocks the AI Creator Studio and the Perks Vault. Unlike Lifetime XP, a tier requalifies — it is earned on your recent activity, and it can step back if you go quiet.
          </p>
          <p className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 24px" }}>
            Illustrative thresholds — final values set before launch.
          </p>
          <div className="tiers-row">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="xp-card"
                style={{
                  padding: 22,
                  ...(t.dark
                    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }
                    : t.borderColor
                    ? { borderColor: t.borderColor }
                    : {}),
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.1em",
                    color: t.nameColor,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: t.dark ? "rgba(244,239,230,0.6)" : "var(--ink-mute)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Requalifies on
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: t.dark ? "rgba(244,239,230,0.85)" : "var(--ink-soft)",
                    marginBottom: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {t.requal}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: t.dark ? "rgba(244,239,230,0.6)" : "var(--ink-mute)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Unlocks
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: t.dark ? "rgba(244,239,230,0.85)" : "var(--ink-soft)",
                    lineHeight: 1.5,
                  }}
                >
                  {t.unlocks}
                </div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--green)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Stepping back
            </div>
            Tier is recalculated daily on a trailing 90-day window. If your recent activity falls below your tier's line, you get a 14-day grace period — a heads-up, not a penalty. Post within those 14 days and nothing changes. If the window stays low, the tier steps back by one band. <strong>Your Lifetime XP is untouched.</strong> Your record is untouched. Only the access pauses, and it comes straight back when you do.
          </div>
        </section>

        {/* 05 NO DECAY */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="05 // No Decay"
            title={<>Your XP does <em style={{ fontStyle: "italic" }}>not expire.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 18px" }}>
            Earned XP does not decay. It is not removed because you took a week off. What you earned, you keep.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 22px" }}>
            What moves is your tier, because tier reflects recent contribution and the Studio access it unlocks costs real money to provide. That is requalification, not loss. The number that is your record — Lifetime XP — only ever goes up.
          </p>
          <div className="callout warn">
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "#c14b3a",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              One exception
            </div>
            XP earned by gaming the system — fake engagement, collusion rings, farming — can be removed by the team, tied to the specific activity, logged. That is a correction, not decay. Contribute honestly and it never touches you.
          </div>
        </section>

        {/* 06 FOUNDING TIER */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="06 // The Founding Tier"
            title={<>Founding members of the <em style={{ fontStyle: "italic" }}>protocol community.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 24px" }}>
            The Founding Tier is the permanent founding-member designation of the protocol community. It is not a rank and it does not requalify — it is a one-time, lifelong status. Whoever holds it, holds it for good.
          </p>
          <TableCard headers={["Label", "Detail"]} rows={FOUNDING_ROWS} />
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-mute)", marginTop: 20, maxWidth: 760 }}>
            The founding window is open now, through the program's first year. Show up, contribute honestly, and you have a real shot at one of the 100 seats. The community counter is public — you can watch it move.
          </p>
        </section>

        {/* 07 TREND */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="07 // Trend"
            title={<>Where you are <em style={{ fontStyle: "italic" }}>heading.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 24px" }}>
            The trend indicator compares your 30-Day XP to the 30 days before that.
          </p>
          <div className="trends-row">
            <div className="xp-card" style={{ padding: 24 }}>
              <div className="trend-pill up" style={{ marginBottom: 14 }}>↑ Rising</div>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>
                Your 30-Day XP is higher than the prior 30-day period.
              </p>
            </div>
            <div className="xp-card" style={{ padding: 24 }}>
              <div className="trend-pill stable" style={{ marginBottom: 14 }}>→ Stable</div>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>
                Difference is within a small margin either way.
              </p>
            </div>
            <div className="xp-card" style={{ padding: 24 }}>
              <div className="trend-pill down" style={{ marginBottom: 14 }}>↓ Falling</div>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}>
                Your 30-Day XP is lower than the prior 30-day period.
              </p>
            </div>
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-mute)", marginTop: 20, maxWidth: 760 }}>
            The trend is visible on the leaderboard and on your public profile. Rising signals commitment. Falling signals a need to re-engage.
          </p>
        </section>

        {/* 08 LEADERBOARD */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="08 // Leaderboard"
            title={<>Public <em style={{ fontStyle: "italic" }}>and live.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 24px" }}>
            The leaderboard at YOUR_APP_DOMAIN/leaderboard displays all contributors and ambassadors ranked by 30-Day XP by default. Switch to Lifetime XP to see the all-time record.
          </p>
          <TableCard headers={["Feature", "Detail"]} rows={LEADERBOARD_ROWS} />
        </section>

        {/* 09 WHAT XP UNLOCKS */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="09 // What XP Unlocks"
            title={<>Why this <em style={{ fontStyle: "italic" }}>matters.</em></>}
          />
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 760, margin: "0 0 28px" }}>
            XP is not a vanity score. It is the key to everything the program gives back.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {UNLOCKS.map((u) => (
              <div
                key={u.label}
                className="xp-card"
                style={{ padding: "24px 26px", borderLeft: `3px solid ${u.accent}` }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: u.labelColor ?? u.accent,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {u.label}
                </div>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>
                  {u.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 10 PRINCIPLES */}
        <section style={{ padding: "clamp(32px, 6vw, 48px) 0", borderTop: "1px solid var(--line)" }}>
          <SectionHeader
            num="10 // Principles"
            title={<>How we <em style={{ fontStyle: "italic" }}>built this.</em></>}
          />
          <div className="prin-row">
            {META_PRINCIPLES.map((p) => (
              <div key={p.num} className="xp-card" style={{ padding: "26px 28px" }}>
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
                  // {p.num}
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 19,
                    fontWeight: 500,
                    marginBottom: 8,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {p.title}
                </div>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "clamp(48px, 8vw, 80px) 0 0", textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>· Ambassador Program</div>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              margin: "0 0 32px",
            }}
          >
            The leaderboard <em style={{ fontStyle: "italic" }}>is live.</em>
          </h2>
          <Link href="/leaderboard" className="paper-btn-primary">
            View leaderboard ↗
          </Link>
        </section>
      </div>

      <SiteFooter />
    </>
  );
}
