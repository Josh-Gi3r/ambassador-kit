/**
 * Home — paper-palette v2.
 * Sections: Hero · Origin · Purpose · Tracks (tabbed) · Principles + Moments · Grow (Tiers + Value) · FAQ · CTA.
 * All copy is driven by VITE_* env vars so you can customise without touching this file.
 */
import { useState } from "react";
import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// ── DATA ────────────────────────────────────────────────────────────────────

const ORIGIN_QUOTE = import.meta.env.VITE_ORIGIN_QUOTE ?? "The program began as an open call. The response surfaced contributors already embedded in the networks where our community lives.";
const ORIGIN_ATTRIBUTION = import.meta.env.VITE_ORIGIN_ATTRIBUTION ?? "PROGRAM TEAM  //  YOUR ORGANIZATION";
const ORIGIN_PARAGRAPHS = [
  "The initiative began as a simple open call. The response surfaced community operators, builders, and creators already embedded in the networks where your community lives.",
  "This cohort became the foundation of the ambassador network. The program structure was built around the roles these contributors were already playing.",
];
const TIMELINE = [
  { label: "Spark", text: "The program launched as a simple initiative to find people who truly understood what your organization is building." },
  { label: "Response", text: "The response was overwhelming, with participants stepping forward from across the community." },
  { label: "First Ambassadors", text: "From that response, a small group naturally emerged — people already aligned with the mission and ready to represent the program in their communities." },
  { label: "The Next Step", text: "That signal led to something bigger: the Ambassador Program, opening the opportunity for more people to step forward and help bring the mission to life." },
];
const PURPOSE_PARAS = [
  "Your community already operates through trusted networks. Developer ecosystems require builders who can integrate and ship. Industry audiences need clear explanation before they adopt.",
  "The ambassador program creates a distributed network of contributors who expand your organization across communities, developer ecosystems, and industry audiences.",
];
const PURPOSE_MATRIX = [
  { label: "Why", value: "Adoption moves through trusted networks." },
  { label: "How", value: "Ambassadors activate those networks for the program." },
  { label: "Who", value: "Community operators · Builders · Creators" },
  { label: "Outcome", value: "Real adoption in communities and ecosystems." },
];
const TRACK_PROBLEMS = [
  { tag: "Community Track solves", title: "The Trust Problem", body: "People don't switch platforms because of features. They switch because someone they trust told them to. Your program needs those people." },
  { tag: "Developer Track solves", title: "The Integration Problem", body: "Infrastructure without integrations moves no volume. Your program needs builders who understand the stack, ship fast, and bring others with them." },
  { tag: "Content Track solves", title: "The Understanding Problem", body: "What you're building is complex. Builders and partners need to understand it before they'll build on it. Language-led creators get there first." },
];
const TRACKS = [
  {
    bg: "linear-gradient(145deg, #d8ccba, #c4b08a)",
    badge: "T1 // COMMUNITY",
    name: "Community Ambassador",
    desc: "Bridge figures embedded in the real communities where your audience lives. They do not recruit for the program. They extend the trust they already hold within their communities.",
    rows: [
      { key: "Who", val: "Community leaders · Group organisers · Trusted guides · Cross-border traders · Network connectors" },
      { key: "Environment", val: "Community meetups · WhatsApp groups · Telegram channels · Local financial discussions · Real-world trust networks" },
      { key: "Output", val: "Community education · Local connections · Trusted word-of-mouth adoption" },
      { key: "Structure", val: "Community-led. Ambassadors operate inside the networks they already belong to, extending trust rather than building audiences from scratch." },
    ],
  },
  {
    bg: "linear-gradient(145deg, #c8d8cc, #a4c4aa)",
    badge: "T2 // DEVELOPER",
    name: "Developer Ambassador",
    desc: "Builders who understand the technical stack and integrate your protocol into what they ship. They represent the program in their ecosystem. Integrations are their output.",
    rows: [
      { key: "Who", val: "Web3 payment devs · Fintech engineers · Hackathon leads · DeFi builders · Infrastructure contributors" },
      { key: "Hubs", val: "ETHGlobal Singapore · ETHKL · ETH Bangkok · ETH Vietnam · ETHJKT · Devcon SEA" },
      { key: "Output", val: "Working integrations · Developer workshops · Hackathon entries · Technical support in ecosystem channels" },
      { key: "Structure", val: "Global, not country-led. Organised by ecosystem: EVM, payment infra, stablecoin rails. Geography is secondary." },
    ],
  },
  {
    bg: "linear-gradient(145deg, #d4ccd8, #b8a8c8)",
    badge: "T3 // CONTENT",
    name: "Content Ambassador",
    desc: "Creators who explain what your project does and why it matters, in the language their audience speaks. Not KOL recruiters. The creators themselves.",
    rows: [
      { key: "Who", val: "Payments writers · Stablecoin researchers · DeFi educators · Crypto journalists · Micro-KOLs (5K–50K)" },
      { key: "Platforms", val: "X + YouTube (PH/SG/UK) · TikTok + Instagram (ID/MY) · Podcasts · Substack" },
      { key: "Content", val: "Technical explainers · Research threads · Twitter Spaces · Founder Q&As · Educational guides" },
      { key: "Structure", val: "Language-led, one language, one distinct audience. Tagalog, BM/BI, Mandarin, English." },
    ],
  },
];
const PRINCIPLES = [
  { num: "01", title: "Merit Before Title", body: "Contribution comes before recognition. The title is earned by what you do before you have it, not by applying for it." },
  { num: "02", title: "Community Before Promotion", body: "Relationships before reach. Ambassadors are trusted figures in real communities, not marketing channels." },
  { num: "03", title: "Opportunity Through Contribution", body: "The program is free to join and free to grow in. What you put in determines where you go. The best contributors become the first hires." },
  { num: "04", title: "Quality Over Scale", body: "A small founding cohort done right is worth more than a thousand names on a list. The Ambassador title means something because it is not handed out freely." },
];
const MOMENTS = [
  { bg: "linear-gradient(145deg, #e8d5b0, #d4b87a)", caption: "Merit before title.", tag: "principle 01" },
  { bg: "linear-gradient(145deg, #cdd8c8, #a8c4a0)", caption: "Community before promotion.", tag: "principle 02" },
  { bg: "linear-gradient(145deg, #d8cfc0, #c0b098)", caption: "Opportunity through contribution.", tag: "principle 03" },
  { bg: "linear-gradient(145deg, #d4ccd8, #b8a8c8)", caption: "Quality over scale.", tag: "principle 04" },
];
const TIERS = [
  { num: "ENTRY", name: "Community Contributor", desc: "Contribute. Get noticed. Prove alignment before any title is granted.", criteria: "No formal status. Actions speak. Most participants remain contributors until consistent impact is demonstrated." },
  { num: "TIER 01", name: "Ambassador", desc: "Official title. Event budget. Merch and giveaway support.", criteria: "Invite-only. Demonstrated action required." },
  { num: "TIER 02", name: "Lead Ambassador", desc: "Country or ecosystem lead. Recruit + manage ambassadors below.", criteria: "Higher budget allocation. Manages ambassadors below." },
  { num: "TIER 03", name: "Ecosystem Lead", desc: "Deepest protocol access. First consideration for full-time roles.", criteria: "Proven impact across community, ecosystem, or content." },
  { num: "⚡ TOP TIER", name: "Full-Time", desc: "First hire per market. Program builds the pipeline for every role.", criteria: "Country lead, Dev Rel, BD, Partnerships.", peak: true },
];
const TIER_TARGETS = [
  { role: "Contributors", num: "500–1,000" },
  { role: "Ambassadors", num: "20–40" },
  { role: "Leads", num: "5–10" },
  { role: "Architects", num: "1–3" },
  { role: "Full-Time Team", num: "5+ mkts" },
];
const VALUE = [
  { num: "01 // AI STUDIO", title: "AI Creator Studio", featured: true, href: "/dashboard", items: [
    "A branded AI workspace built into the portal",
    "Text, image, and video generation — tier-gated",
    "Initiate: text. Active: adds image. Champion: adds video. Elite: frontier models.",
    "The tool you unlock is the tool you use to earn your next tier.",
  ] },
  { num: "02 // PERKS VAULT", title: "Perks Vault", href: "/dashboard", items: [
    "Software deals and creator tools, unlocked by tier",
    "Branded Perks — deeper access as you climb",
    "Active tier required. Steps back if contribution drops.",
  ] },
  { num: "03 // EVANGELIST", title: "Evangelist Trips", href: "/roles", items: [
    (import.meta.env.VITE_EVANGELIST_EVENT ?? "Program summit — invite-only"),
    "Limited slots. Hand-picked by the team.",
    "Flight, accommodation, and expenses fully covered.",
    "The Evangelist badge is your ticket.",
  ] },
  { num: "04 // CAREER", title: "Career Progression", href: "/roles", items: [
    "Country ecosystem lead, first role per market",
    "Developer relations and regional growth positions",
    "Partnership and business development roles",
    "Full-time employment: the program builds the talent pipeline",
  ] },
];
const FAQ = [
  { q: "Can I apply if I am not already active on X?", a: "Yes, but your score will reflect your activity level. The X-related components (content, engagement, consistency) are scored manually by the admin team based on what they observe. If you are not active on X, those scores will be low." },
  { q: "How often are scores updated?", a: "Scores are updated by the admin team on a rolling basis. There is no fixed schedule — the team reviews activity and updates scores as they observe it." },
  { q: "Can I lose my Ambassador rank?", a: "Your position on the leaderboard is relative — if others improve and your XP stagnates, you drop. The L2 Ambassador designation is granted by the team and can be revoked if needed, but it is not automatically removed based on XP." },
  { q: "How do I know if I have been selected as an Evangelist?", a: "You will be notified by the team directly. The Evangelist badge will appear on your public profile and dashboard." },
  { q: "What is the difference between the Evangelist badge and the Ambassador rank?", a: "The Ambassador rank (L2) is earned through your performance score and is visible to everyone on the leaderboard. The Evangelist badge is a separate, manually awarded designation for the cohort selected for program events. You can have one without the other." },
  { q: "Does my XP ever expire or decay?", a: "Lifetime XP never decays. Tier requalifies on a trailing 90-day window — if you go quiet, your tier can step back, but Lifetime XP only ever goes up. The one exception: XP earned by gaming the system can be removed by the team, tied to the specific activity." },
  { q: "Is the Founding Tier still open?", a: "Yes, for now. The Founding Tier closes when the community's combined Lifetime XP crosses the founding threshold, or when every founding seat is filled — whichever comes first. After that, it can never be earned again. The community counter on the leaderboard is public." },
  { q: "How does the AI Creator Studio work?", a: "It's a branded AI workspace built into the portal. Text, image, and video generation, tier-gated. Initiate starts with text. Active adds image. Champion adds video. Elite runs frontier models at top quality. The tool you unlock is the tool you use to earn your next tier." },
];

// ── SECTIONS ────────────────────────────────────────────────────────────────
function Hero() {
  // imgH = photo image area height; total card height = imgH + 40px caption area
  const polaroids = [
    { bg: "linear-gradient(145deg, #e8d5b0 0%, #d4b87a 100%)", top: -30, left: -60, width: 260, imgH: 320, rotate: -8,  z: 4, quote: "Show up. The rest follows." },
    { bg: "linear-gradient(145deg, #cdd8c8 0%, #a8c4a0 100%)", top: 80,  left: 120, width: 270, imgH: 330, rotate: 2,   z: 3, quote: "Trust travels in conversation." },
    { bg: "linear-gradient(145deg, #d8cfc0 0%, #c0b098 100%)", top: 220, left: 300, width: 255, imgH: 315, rotate: 10,  z: 2, quote: "Real adoption is real people." },
  ];
  return (
    <section className="paper-noise" style={{ position: "relative", overflow: "visible" }}>
      <div className="paper-container" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--green)", textTransform: "uppercase", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
              <span className="paper-dot" /> {import.meta.env.VITE_APP_NAME ?? "Your Protocol"} · Ambassador Program
            </div>
            <h1 className="serif" style={{ fontSize: "clamp(56px, 8vw, 112px)", lineHeight: 0.92, letterSpacing: "-0.03em", fontWeight: 400, margin: "0 0 28px", color: "var(--ink)" }}>
              Ambassador<br />
              <em style={{ fontWeight: 500, color: "var(--green)", fontStyle: "italic" }}>Program.</em>
            </h1>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink-soft)", letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
              <span>Community</span>
              <span style={{ color: "var(--green)" }}>//</span>
              <span>Builders</span>
              <span style={{ color: "var(--green)" }}>//</span>
              <span>Adoption</span>
            </div>
            <p className="serif" style={{ fontSize: 22, lineHeight: 1.45, color: "var(--ink)", maxWidth: 540, marginBottom: 36, borderLeft: "3px solid var(--green)", paddingLeft: 22, fontWeight: 400, fontStyle: "italic" }}>
              {import.meta.env.VITE_HERO_TAGLINE ?? "Ambassadors are the people who bring the mission into the real world."}
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/apply" className="paper-btn-primary">Apply now ↗</Link>
              <a href="#tracks" className="paper-btn-ghost">See the tracks</a>
            </div>
          </div>
          <div className="hero-collage" style={{ position: "relative", height: 620, minWidth: 0, overflow: "visible" }}>
            {polaroids.map((p, i) => (
              <div
                key={i}
                className="polaroid-card"
                style={{
                  position: "absolute",
                  top: p.top,
                  left: p.left,
                  width: p.width,
                  zIndex: p.z,
                  padding: "6px 6px 0",
                  transform: `rotate(${p.rotate}deg)`,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  boxShadow: "0 14px 28px rgba(20,20,15,0.10), 0 6px 12px rgba(20,20,15,0.06)",
                  [`--pol-base` as string]: `rotate(${p.rotate}deg)`,
                }}
              >
                <div className="polaroid-photo" style={{ width: "100%", height: p.imgH, display: "block", background: p.bg }} />
                <div style={{ padding: "8px 6px 10px", fontFamily: "'Fraunces', serif", fontSize: 13, fontStyle: "italic", fontWeight: 500, color: "#1a1a1a", lineHeight: 1.3, textAlign: "center" }}>
                  "{p.quote}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes polaroid-shake {
          0%   { transform: var(--pol-base) translateY(0); }
          20%  { transform: var(--pol-base) rotate(3deg) translateY(-4px); }
          40%  { transform: var(--pol-base) rotate(-3deg) translateY(-6px); }
          60%  { transform: var(--pol-base) rotate(2deg) translateY(-3px); }
          80%  { transform: var(--pol-base) rotate(-1deg) translateY(-1px); }
          100% { transform: var(--pol-base) translateY(0); }
        }
        .polaroid-card { transition: box-shadow 0.2s; }
        @media (hover: hover) {
          .polaroid-card:hover {
            animation: polaroid-shake 0.5s ease;
            box-shadow: 0 24px 48px rgba(20,20,15,0.18), 0 8px 16px rgba(20,20,15,0.10) !important;
            z-index: 10 !important;
          }
        }
        /* ── tablet ── */
        @media (max-width: 980px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
          .hero-collage { height: 360px !important; margin-top: 24px !important; }
          .hero-collage > div:nth-child(1) { width: 190px !important; left: 10px !important; top: 20px !important; }
          .hero-collage > div:nth-child(1) .polaroid-photo { height: 220px !important; }
          .hero-collage > div:nth-child(2) { width: 200px !important; left: 170px !important; top: 0 !important; }
          .hero-collage > div:nth-child(2) .polaroid-photo { height: 230px !important; }
          .hero-collage > div:nth-child(3) { width: 185px !important; left: 330px !important; top: 40px !important; }
          .hero-collage > div:nth-child(3) .polaroid-photo { height: 215px !important; }
        }
        /* ── small tablet ── */
        @media (max-width: 720px) {
          .hero-collage { height: 300px !important; margin-top: 16px !important; }
          .hero-collage > div:nth-child(1) { width: 155px !important; left: 0 !important; top: 30px !important; }
          .hero-collage > div:nth-child(1) .polaroid-photo { height: 175px !important; }
          .hero-collage > div:nth-child(2) { width: 162px !important; left: 130px !important; top: 0 !important; }
          .hero-collage > div:nth-child(2) .polaroid-photo { height: 185px !important; }
          .hero-collage > div:nth-child(3) { width: 150px !important; left: 258px !important; top: 40px !important; }
          .hero-collage > div:nth-child(3) .polaroid-photo { height: 170px !important; }
        }
        /* ── mobile: single column, stacked vertically ── */
        @media (max-width: 480px) {
          .hero-collage {
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 16px !important;
            margin-top: 24px !important;
            padding-bottom: 8px !important;
          }
          .hero-collage > div {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            width: 80vw !important;
            max-width: 300px !important;
            transform: none !important;
          }
          .hero-collage > div:nth-child(1) { transform: rotate(-3deg) !important; }
          .hero-collage > div:nth-child(2) { transform: rotate(1deg) !important; }
          .hero-collage > div:nth-child(3) { transform: rotate(4deg) !important; }
          .hero-collage > div .polaroid-photo { height: 200px !important; }
          .hero-collage > div > div { font-size: 14px !important; }
        }
      `}</style>
    </section>
  );
}

function Origin() {
  return (
    <section id="origin" className="paper-noise" style={{ background: "var(--paper-2)", padding: "100px 0 0", position: "relative" }}>
      <div className="paper-container">
        <div className="origin-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase", marginBottom: 16 }}>· 00 // Origin</div>
            <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: "0 0 28px", fontWeight: 400 }}>
              How This <em style={{ fontStyle: "italic" }}>Started.</em>
            </h2>
            <blockquote className="serif" style={{ fontSize: 22, fontStyle: "italic", lineHeight: 1.5, color: "var(--ink)", borderLeft: "3px solid var(--green)", paddingLeft: 22, margin: "0 0 28px", fontWeight: 400 }}>
              "{ORIGIN_QUOTE}"
            </blockquote>
            {ORIGIN_PARAGRAPHS.map((p, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-soft)", margin: "0 0 14px", maxWidth: 520 }}>{p}</p>
            ))}
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", letterSpacing: "0.08em", marginTop: 12 }}>— {ORIGIN_ATTRIBUTION}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {TIMELINE.map((t, i) => (
              <div key={i} className="timeline-card" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderLeft: "3px solid var(--green)", padding: "22px 26px", borderRadius: 4, display: "grid", gridTemplateColumns: "140px 1fr", gap: 20 }}>
                <div className="mono" style={{ fontSize: 12, color: "var(--green)", letterSpacing: "0.12em", textTransform: "uppercase", paddingTop: 6, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}>{t.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 80, height: 320, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #d4ccbc 0%, #b8ac9a 60%, #a89880 100%)" }} />
      </div>
      <style>{`
        @media (max-width: 980px) {
          .origin-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .timeline-card { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>
    </section>
  );
}

function Purpose() {
  return (
    <section id="purpose" className="paper-noise" style={{ padding: "100px 0", position: "relative" }}>
      <div className="paper-container">
        <div className="purpose-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "start" }}>
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase", marginBottom: 16 }}>· 01 // Purpose</div>
            <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: "0 0 28px", fontWeight: 400 }}>
              Why This Program <em style={{ fontStyle: "italic" }}>Exists.</em>
            </h2>
            {PURPOSE_PARAS.map((p, i) => (
              <p key={i} style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", margin: "0 0 16px" }}>{p}</p>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PURPOSE_MATRIX.map((m, i) => {
              const dark = i === 1 || i === 2;
              return (
                <div key={m.label} style={{ background: dark ? "var(--ink)" : "var(--paper-2)", color: dark ? "var(--paper)" : "var(--ink)", border: "1px solid " + (dark ? "var(--ink)" : "var(--line)"), borderRadius: 8, padding: "24px 22px", minHeight: 140 }}>
                  <div className="mono" style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, color: dark ? "var(--green-brand)" : "var(--green)", marginBottom: 10 }}>{m.label}</div>
                  <div className="serif" style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.35, fontStyle: "italic" }}>{m.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .purpose-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  );
}

function Tracks() {
  const [active, setActive] = useState(0);
  const t = TRACKS[active];
  return (
    <section id="tracks" className="paper-noise" style={{ background: "var(--paper-2)", padding: "100px 0", position: "relative" }}>
      <div className="paper-container">
        <div style={{ marginBottom: 32, maxWidth: 760 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase", marginBottom: 16 }}>· 02 // Tracks</div>
          <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, fontWeight: 400 }}>
            Three Tracks Address <em style={{ fontStyle: "italic" }}>Three Adoption Barriers.</em>
          </h2>
        </div>
        <div className="problems-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 56 }}>
          {TRACK_PROBLEMS.map((p) => (
            <div key={p.title} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderTop: "3px solid var(--green)", borderRadius: 4, padding: "22px 24px" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{p.tag}</div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2, color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em" }}>{p.title}</div>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {TRACKS.map((tr, i) => (
            <button key={tr.badge} onClick={() => setActive(i)} style={{ border: "1px solid " + (active === i ? "var(--ink)" : "var(--line)"), background: active === i ? "var(--ink)" : "transparent", color: active === i ? "var(--paper)" : "var(--ink)", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: "10px 18px", borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: active === i ? "var(--green-brand)" : "var(--green)" }} />
              {tr.badge}
            </button>
          ))}
        </div>
        <div key={active} className="track-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ position: "relative", aspectRatio: "5/4", overflow: "hidden", borderRadius: 6 }}>
              <div style={{ width: "100%", height: "100%", background: t.bg }} />
              <div className="paper-sticker" style={{ position: "absolute", top: 18, left: 18, transform: "rotate(-3deg)" }}>★ {t.badge}</div>
            </div>
          </div>
          <div>
            <h3 className="serif" style={{ fontSize: 38, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 18px" }}>{t.name}</h3>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink-soft)", margin: "0 0 28px" }}>{t.desc}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid var(--line)", paddingTop: 22 }}>
              {t.rows.map((r) => (
                <div key={r.key} className="ex-row" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 20 }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: "0.1em", textTransform: "uppercase", paddingTop: 3, fontWeight: 700 }}>{r.key}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)" }}>{r.val}</div>
                </div>
              ))}
            </div>
            <Link href="/apply" className="paper-btn-primary" style={{ marginTop: 28 }}>
              Apply as {t.name.split(" ")[0]} Ambassador ↗
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .problems-grid { grid-template-columns: 1fr !important; }
          .track-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .ex-row { grid-template-columns: 1fr !important; gap: 4px !important; }
        }
      `}</style>
    </section>
  );
}

function Principles() {
  return (
    <section id="principles" className="paper-noise" style={{ padding: "100px 0", position: "relative" }}>
      <div className="paper-container">
        <div style={{ marginBottom: 56, maxWidth: 720 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase", marginBottom: 16 }}>· 03 // Principles</div>
          <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, fontWeight: 400 }}>
            How This Program <em style={{ fontStyle: "italic" }}>Works.</em>
          </h2>
        </div>
        <div className="principles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
          {PRINCIPLES.map((p) => (
            <div key={p.num} style={{ background: "var(--paper-2)", border: "1px solid var(--line)", padding: "32px 30px", borderRadius: 8, borderLeft: "3px solid var(--green)" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>// {p.num}</div>
              <h3 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15, margin: "0 0 10px" }}>{p.title}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <div className="moments-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, alignItems: "flex-start" }}>
            {MOMENTS.map((m, i) => {
              const tilts = ["rotate(-2deg)", "rotate(1.5deg)", "rotate(-1deg)", "rotate(2deg)"];
              return (
                <div key={m.caption} style={{ background: "#fff", padding: "10px 10px 18px", boxShadow: "0 18px 32px -22px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.06)", border: "1px solid rgba(0,0,0,0.04)", transform: tilts[i], marginTop: i % 2 === 1 ? 28 : 0 }}>
                  <div style={{ aspectRatio: "4/5", overflow: "hidden", position: "relative" }}>
                    <div style={{ width: "100%", height: "100%", background: m.bg }} />
                  </div>
                  <div style={{ padding: "12px 6px 0" }}>
                    <div className="serif" style={{ fontSize: 17, fontStyle: "italic", color: "#1a1a1a", lineHeight: 1.2, marginBottom: 4 }}>{m.caption}</div>
                    <div className="mono" style={{ fontSize: 10, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.tag}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .principles-grid { grid-template-columns: 1fr !important; }
          .moments-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 18px !important; }
          .moments-grid > div { transform: none !important; margin-top: 0 !important; }
        }
      `}</style>
    </section>
  );
}

function Grow() {
  return (
    <section id="grow" style={{ background: "var(--ink)", color: "var(--paper)", padding: "100px 0" }}>
      <div className="paper-container">
        <div style={{ marginBottom: 32, maxWidth: 720 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green-brand)", textTransform: "uppercase", marginBottom: 16 }}>· 04 // Program Flow</div>
          <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, fontWeight: 400, color: "var(--paper)" }}>
            Tier <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>Progression.</em>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(244,239,230,0.7)", maxWidth: 620, marginTop: 16 }}>
            Entry into the program means joining the contributor network. Ambassador status is earned through demonstrated contribution over time.
          </p>
        </div>
        <div className="tiers-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
          {TIERS.map((t, i) => (
            <div key={t.num} className="tier-cell" style={{ padding: "28px 22px", borderRight: i < TIERS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none", background: t.peak ? "var(--green-brand)" : i === 0 ? "rgba(255,255,255,0.04)" : "transparent", color: t.peak ? "var(--ink)" : "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.peak ? "rgba(0,0,0,0.6)" : "var(--green-brand)", marginBottom: 16, fontWeight: 700 }}>{t.num}</div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1, marginBottom: 12 }}>{t.name}</div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: t.peak ? "rgba(0,0,0,0.7)" : "rgba(244,239,230,0.7)", margin: "0 0 14px" }}>{t.desc}</p>
              <div style={{ paddingTop: 12, borderTop: t.peak ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.08)", fontSize: 13, lineHeight: 1.5, color: t.peak ? "rgba(0,0,0,0.55)" : "rgba(244,239,230,0.55)" }}>{t.criteria}</div>
            </div>
          ))}
        </div>
        <div className="targets-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, marginTop: 14, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
          {TIER_TARGETS.map((t, i) => (
            <div key={t.role} className="target-cell" style={{ padding: "16px 22px", borderRight: i < TIER_TARGETS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none", background: "rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 12, color: "rgba(244,239,230,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.role}</span>
              <span className="serif" style={{ fontSize: 16, fontWeight: 500, color: "var(--green-brand)", letterSpacing: "-0.01em" }}>{t.num}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 64, marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green-brand)", textTransform: "uppercase", marginBottom: 16 }}>· 05 // Value Model</div>
          <h3 className="serif" style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 32px", fontWeight: 400, color: "var(--paper)" }}>
            What Ambassadors <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>Receive.</em>
          </h3>
        </div>
        <div className="value-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {VALUE.map((v) => (
            <Link key={v.num} href={v.href} style={{ padding: "28px 24px", background: v.featured ? "rgba(0,255,157,0.06)" : "rgba(255,255,255,0.04)", border: "1px solid " + (v.featured ? "rgba(0,255,157,0.25)" : "rgba(255,255,255,0.08)"), borderRadius: 8, textDecoration: "none", display: "block", color: "inherit" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--green-brand)", letterSpacing: "0.1em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                {v.num}
                <span style={{ flex: 1, height: 1, background: "rgba(0,255,157,0.4)" }} />
              </div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--paper)" }}>{v.title}</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {v.items.map((it) => (
                  <li key={it} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "rgba(244,239,230,0.75)", lineHeight: 1.5 }}>
                    <span style={{ color: "var(--green-brand)", fontWeight: 700, flexShrink: 0 }}>—</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <div className="mono" style={{ marginTop: 16, fontSize: 10, color: "var(--green-brand)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Open →</div>
            </Link>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 1080px) {
          .tiers-grid, .targets-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .tier-cell, .target-cell { border-right: 1px solid rgba(255,255,255,0.08) !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
        }
        @media (max-width: 960px) { .value-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) {
          .tiers-grid, .targets-grid, .value-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="paper-noise" style={{ background: "var(--paper-2)", padding: "100px 0", position: "relative" }}>
      <div className="paper-container">
        <div className="faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 64, alignItems: "start" }}>
          <div style={{ position: "sticky", top: 100 }}>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase", marginBottom: 16 }}>· 06 // FAQ</div>
            <h2 className="serif" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: "0 0 18px", fontWeight: 400 }}>
              Frequently asked, <em style={{ fontStyle: "italic" }}>plainly answered.</em>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--ink-soft)", margin: "0 0 24px" }}>
              Everything below is from the official program docs. If your question isn't here, hop into the Telegram and ask.
            </p>
            <a href={import.meta.env.VITE_COMMUNITY_TELEGRAM_URL ?? "#"} target="_blank" rel="noreferrer" className="paper-btn-ghost">
              Ask in Telegram ↗
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ background: "var(--paper)", border: "1px solid", borderColor: open === i ? "var(--ink)" : "var(--line)", borderRadius: 10, marginBottom: 10, overflow: "hidden", transition: "border-color .15s" }}>
                <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: "100%", padding: "22px 24px", background: "transparent", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left", gap: 16, color: "var(--ink)" }}>
                  <span className="serif" style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.3, flex: 1 }}>{item.q}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: open === i ? "var(--green)" : "var(--ink-mute)", transition: "transform .2s", transform: open === i ? "rotate(45deg)" : "rotate(0deg)", flexShrink: 0 }}>+</span>
                </button>
                {open === i && (
                  <div style={{ padding: "0 24px 22px", fontSize: 15, lineHeight: 1.65, color: "var(--ink-soft)" }}>{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .faq-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ position: "relative", minHeight: 520, display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #2a2a20 0%, #1a1a12 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,20,15,0.35), rgba(20,20,15,0.65))" }} />
        <div className="paper-container" style={{ position: "relative", textAlign: "center", padding: "100px 28px" }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--green-brand)", letterSpacing: "0.2em", marginBottom: 24, textTransform: "uppercase" }}>
            · Ambassador Program
          </div>
          <h2 className="serif" style={{ fontSize: "clamp(48px, 7vw, 92px)", lineHeight: 0.98, letterSpacing: "-0.025em", color: "#fff", fontWeight: 400, margin: "0 auto 36px", maxWidth: 1000 }}>
            Ready to Build<br />
            <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>the Network?</em>
          </h2>
          <Link href="/apply" className="paper-btn-primary" style={{ background: "var(--green-brand)", color: "var(--ink)", fontSize: 16, padding: "16px 28px" }}>
            Apply Now ↗
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <Hero />
      <Origin />
      <Purpose />
      <Tracks />
      <Principles />
      <Grow />
      <FAQSection />
      <CTA />
      <SiteFooter />
    </>
  );
}
