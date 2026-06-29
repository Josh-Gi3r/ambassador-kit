import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type RoleRow = {
  badge: string;
  name: string;
  desc: string;
  meta: { label: string; value: string }[];
};

const TRACKS: RoleRow[] = [
  {
    badge: "★ T1 · Community",
    name: "Community Ambassador",
    desc: "Bridge figures embedded in the real communities where cross-border money moves — migrant workers, diaspora networks, remittance circles, and local money-changing ecosystems. They do not recruit for the protocol. They extend the trust they already hold within their communities.",
    meta: [
      { label: "Who", value: "Migrant worker community leaders · Diaspora organisers · Remittance guides · Informal money changers · Cross-border traders" },
      { label: "Environment", value: "Community meetups · WhatsApp groups · Telegram channels · Local financial discussions · Real-world trust networks" },
      { label: "Output", value: "Community education · Corridor introductions · Local operator connections · Trusted word-of-mouth adoption" },
      { label: "Structure", value: "Community-led. Ambassadors operate inside the networks they already belong to, extending trust rather than building audiences from scratch." },
    ],
  },
  {
    badge: "★ T2 · Developer",
    name: "Developer Ambassador",
    desc: "Builders who understand payment infrastructure at a technical level and integrate the protocol into what they ship. They don't represent the protocol in their country, they represent it in their ecosystem. Integrations are their output.",
    meta: [
      { label: "Who", value: "Web3 payment devs · Fintech engineers · Hackathon leads · DeFi builders · Infrastructure contributors" },
      { label: "Hubs", value: "ETHGlobal Singapore · ETHKL · ETH Bangkok · ETH Vietnam · ETHJKT · Devcon SEA" },
      { label: "Output", value: "Working integrations · Developer workshops · Hackathon entries · API support in ecosystem channels" },
      { label: "Structure", value: "Global, not country-led. Organised by ecosystem: EVM, payment infra, stablecoin rails. Geography is secondary." },
    ],
  },
  {
    badge: "★ T3 · Content",
    name: "Content Ambassador",
    desc: "Creators who explain what stablecoin FX settlement is and why it matters, in the language their audience speaks, for audiences that already care about money and crypto. Not KOL recruiters. The creators themselves.",
    meta: [
      { label: "Who", value: "Payments writers · Stablecoin researchers · DeFi educators · Crypto journalists · Micro-KOLs (5K–50K)" },
      { label: "Platforms", value: "X + YouTube (PH/SG/UK) · TikTok + Instagram (ID/MY) · Podcasts · Substack" },
      { label: "Content", value: "Technical explainers · Research threads · Twitter Spaces · FX corridor stories · Platform media output" },
      { label: "Structure", value: "Language-led, one language, one distinct audience. Tagalog, BM/BI, Mandarin, English." },
    ],
  },
];

type TierStep = { num: string; name: string; body: string; peak?: boolean };
const LADDER: TierStep[] = [
  { num: "Entry", name: "Community Contributor", body: "Contribute. Get noticed. Prove alignment before any title is granted. No formal status. Actions speak." },
  { num: "Tier 01", name: "Ambassador", body: "Official title. Event budget. Merch and giveaway support. Invite-only. Demonstrated action required." },
  { num: "Tier 02", name: "Lead Ambassador", body: "Country or ecosystem lead. Recruit + manage ambassadors below. Higher budget allocation." },
  { num: "Tier 03", name: "Ecosystem Lead", body: "Deepest protocol access. First consideration for full-time roles. Proven impact across community, ecosystem, or content." },
  { num: "⚡ Top tier", name: "Full-Time Team Member", body: "First hire per market. The program builds the pipeline for every country role. Country lead, Dev Rel, BD, Partnerships.", peak: true },
];

export default function Roles() {
  return (
    <>
      <SiteHeader />
      <style>{`
        .role-row { display: grid; grid-template-columns: 160px 1fr; gap: 24px; padding: 24px 0; border-bottom: 1px solid var(--line); }
        .role-row:last-child { border-bottom: none; }
        .role-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 18px; }
        @media (max-width: 720px) { .role-row { grid-template-columns: 1fr; gap: 8px; } .role-meta { grid-template-columns: 1fr !important; } }
        .ladder { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-top: 36px; }
        @media (max-width: 1080px) { .ladder { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 560px)  { .ladder { grid-template-columns: 1fr !important; } }
        .tier-step { background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 22px; position: relative; }
        .tier-step.peak { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .tier-step.peak .tier-num { color: var(--green-brand); }
        .tier-step.peak .tier-body { color: rgba(244,239,230,0.7); }
        .tier-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; color: var(--green); text-transform: uppercase; font-weight: 700; margin-bottom: 12px; }
        .tier-name { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; margin-bottom: 8px; letter-spacing: -0.01em; }
        .tier-body { font-size: 14px; line-height: 1.55; color: var(--ink-soft); }
        .evang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
        @media (max-width: 860px) { .evang-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Hero */}
      <section className="paper-noise" style={{ padding: "clamp(44px, 8vw, 72px) 0 clamp(36px, 6vw, 56px)", position: "relative" }}>
        <div className="paper-container">
          <div className="paper-pill" style={{ marginBottom: 24 }}>
            <span className="paper-dot" /> Three tracks · Five tiers · One program
          </div>
          <h1 className="h-display serif">
            Roles in the <em>Ambassador Program.</em>
          </h1>
          <p className="lead">
            This protocol is building the infrastructure for the future. Ambassadors are the people bringing that future into the real world.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/apply" className="paper-btn-primary">Apply now ↗</Link>
            <Link href="/" className="paper-btn-ghost">Back to home</Link>
          </div>
        </div>
      </section>

      {/* The three tracks */}
      <section className="paper-noise" style={{ padding: "clamp(40px, 7vw, 60px) 0", background: "var(--paper-2)", position: "relative" }}>
        <div className="paper-container">
          <div className="eyebrow">· The three tracks</div>
          <h2 className="h-section serif">Three tracks address <em>three adoption barriers.</em></h2>

          <div style={{ marginTop: 36 }}>
            {TRACKS.map((t) => (
              <div className="role-row" key={t.badge}>
                <div><span className="paper-sticker">{t.badge}</span></div>
                <div>
                  <h3 className="serif" style={{ fontSize: 30, lineHeight: 1.1, margin: "0 0 14px", fontWeight: 500, letterSpacing: "-0.02em" }}>{t.name}</h3>
                  <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.65, maxWidth: 740, margin: "0 0 16px" }}>{t.desc}</p>
                  <div className="role-meta">
                    {t.meta.map((m) => (
                      <div key={m.label}>
                        <div className="mono" style={{ fontSize: 11, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5 }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ladder */}
      <section style={{ padding: "clamp(48px, 8vw, 80px) 0" }}>
        <div className="paper-container">
          <div className="eyebrow">· Program flow</div>
          <h2 className="h-section serif">Tier <em>progression.</em></h2>
          <p className="lead" style={{ maxWidth: 640 }}>
            Entry into the program means joining the contributor network. Ambassador status is earned through demonstrated contribution over time.
          </p>

          <div className="ladder">
            {LADDER.map((step) => (
              <div key={step.num} className={`tier-step${step.peak ? " peak" : ""}`}>
                <div className="tier-num">{step.num}</div>
                <div className="tier-name">{step.name}</div>
                <div className="tier-body">{step.body}</div>
              </div>
            ))}
          </div>

          {/* Evangelist callout */}
          <div style={{ marginTop: 60, background: "var(--ink)", color: "var(--paper)", borderRadius: 12, padding: "clamp(22px, 4vw, 40px)" }}>
            <div className="evang-grid">
              <div>
                <div className="mono" style={{ fontSize: 12, color: "var(--green-brand)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>· 03 // Evangelist Trips</div>
                <div className="serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.02em", fontWeight: 500, marginBottom: 14 }}>
                  Twelve slots. <em style={{ fontStyle: "italic" }}>Singapore.</em> October 2026.
                </div>
                <p style={{ color: "rgba(244,239,230,0.75)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                  12 slots. Hand-picked by the team. Flight, accommodation, and expenses fully covered. The Evangelist badge is your ticket.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { num: "12", body: "slots in the first cohort" },
                  { num: "Oct", body: "Token2049 Singapore 2026" },
                  { num: "100%", body: "expenses covered" },
                  { num: "By", body: "invitation only" },
                ].map((s) => (
                  <div key={s.num} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 18 }}>
                    <div className="serif" style={{ fontSize: 36, fontWeight: 500, color: "var(--green-brand)" }}>{s.num}</div>
                    <div style={{ fontSize: 13, color: "rgba(244,239,230,0.7)" }}>{s.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "clamp(48px, 8vw, 80px) 0 clamp(56px, 10vw, 100px)" }}>
        <div className="paper-container" style={{ textAlign: "center" }}>
          <div className="serif" style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 400, marginBottom: 20, maxWidth: 880, margin: "0 auto 20px" }}>
            Ready to Build <em style={{ fontStyle: "italic" }}>the Network?</em>
          </div>
          <Link href="/apply" className="paper-btn-primary" style={{ marginTop: 12 }}>Apply now ↗</Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
