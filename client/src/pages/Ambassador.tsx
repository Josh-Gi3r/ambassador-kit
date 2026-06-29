import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Track = {
  num: string;
  title: string;
  titleBreak: string;
  sticker: string;
  body: React.ReactNode;
  bullets: string[];
  applyHref: string;
};

const TRACKS: Track[] = [
  {
    num: "01",
    title: "Community",
    titleBreak: "Ambassador",
    sticker: "★ Solving: The Trust Problem",
    body: (
      <>
        Cross-border money movement already happens inside real communities: diaspora groups, remittance circles, migrant worker networks, and money changer ecosystems. The people in those communities trust a small number of individuals to guide them.{" "}
        <strong style={{ color: "var(--ink)", fontWeight: 500 }}>You may be one of them.</strong>{" "}
        Your role is to bring the protocol into conversations that are already happening.
      </>
    ),
    bullets: [
      "You are embedded in a diaspora, remittance, or migrant worker community",
      "People already ask you how to send money across borders",
      "You move money internationally yourself and understand the corridors",
      "Your community trusts your guidance on financial decisions",
    ],
    applyHref: "/apply?track=community",
  },
  {
    num: "02",
    title: "Developer",
    titleBreak: "Ambassador",
    sticker: "★ Solving: The Integration Problem",
    body: (
      <>
        Infrastructure without integrations moves no volume. Builders evaluating infrastructure trust other builders. You have worked with this protocol directly.{" "}
        <strong style={{ color: "var(--ink)", fontWeight: 500 }}>You understand how the API behaves and what it takes to integrate.</strong>{" "}
        That firsthand knowledge is what makes other developers trust you.
      </>
    ),
    bullets: [
      "You have integrated with or built on the protocol",
      "Developers rely on your technical judgment",
      "You contribute to open source or share technical work publicly",
      "You find documentation gaps and fix them",
    ],
    applyHref: "/apply?track=developer",
  },
  {
    num: "03",
    title: "Content",
    titleBreak: "Ambassador",
    sticker: "★ Solving: The Understanding Problem",
    body: (
      <>
        Most people who should care about stablecoin FX settlement cannot easily understand what it means for them.{" "}
        <strong style={{ color: "var(--ink)", fontWeight: 500 }}>You translate protocol mechanics into language your audience understands without sacrificing accuracy.</strong>
      </>
    ),
    bullets: [
      "You have an audience in crypto, finance, or fintech",
      "Accuracy comes first. Engagement follows.",
      "You use data and research to support your content",
      "You publish only what you understand well enough to defend",
    ],
    applyHref: "/apply?track=content",
  },
];

type ProgStep = {
  num: string;
  name: string;
  body: string;
  peak?: boolean;
};

const PROG: ProgStep[] = [
  { num: "01", name: "Contributor", body: "Build a track record first. The title follows the work." },
  { num: "02", name: "Ambassador", body: "Earned. Event support, resources, and program access." },
  { num: "03", name: "Lead Ambassador", body: "Running regional programs, mentoring others." },
  { num: "04", name: "Ecosystem Lead", body: "Shaping how the program grows.", peak: true },
  { num: "05", name: "Full-Time Team Member", body: "For those who stand out. This is what a track record is for.", peak: true },
];

export default function Ambassador() {
  return (
    <>
      <SiteHeader />
      <style>{`
        .track-big {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .track-big .head { padding: 30px 28px 6px; }
        .track-big .body { padding: 0 28px 18px; flex: 1; }
        .track-big .checks { padding: 18px 28px; background: var(--paper-2); border-top: 1px solid var(--line); }
        .track-big .foot {
          padding: 18px 28px; background: var(--ink); color: var(--paper);
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; transition: background .15s; text-decoration: none;
        }
        .track-big .foot:hover { background: #000; }
        .check-row {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14px; color: var(--ink-soft); line-height: 1.5;
          padding: 5px 0;
        }
        .check-row .bullet {
          width: 7px; height: 7px; background: var(--green);
          border-radius: 50%; margin-top: 7px; flex-shrink: 0;
        }
        .mission-strip {
          background: var(--green-brand); color: var(--ink);
          padding: 22px 0; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink);
        }
        .tracks-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 1080px) { .tracks-3 { grid-template-columns: 1fr !important; } }
        .prog-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        @media (max-width: 1080px) { .prog-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px)  { .prog-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* HERO */}
      <section style={{ background: "var(--ink)", color: "var(--paper)", padding: "80px 0 64px" }}>
        <div className="paper-container">
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--green-brand)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ width: 8, height: 8, background: "var(--green-brand)" }} />
            Your Protocol // Ambassador Program
          </div>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(48px, 8vw, 92px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              margin: "0 0 36px",
              fontWeight: 400,
              color: "var(--paper)",
            }}
          >
            <span style={{ fontWeight: 300, color: "rgba(244,239,230,0.85)" }}>Infrastructure</span>
            <br />
            <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>is built by</em>
            <br />
            the few.
          </h1>
          <p
            style={{
              maxWidth: 700,
              fontSize: 19,
              lineHeight: 1.6,
              color: "rgba(244,239,230,0.75)",
              borderLeft: "2px solid var(--green-brand)",
              paddingLeft: 22,
              fontWeight: 300,
              margin: 0,
            }}
          >
            This protocol is building infrastructure for the next era of finance. Adoption happens through trusted operators inside real financial networks.{" "}
            <strong style={{ color: "var(--paper)", fontWeight: 500 }}>Three kinds of people carry that forward.</strong>
            <br />
            <br />
            Find out which one you are.
          </p>
        </div>
      </section>

      {/* MISSION STRIP */}
      <div className="mission-strip">
        <div
          className="paper-container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div
            className="serif"
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              fontStyle: "italic",
            }}
          >
            Three tracks. Three adoption barriers. One program.
          </div>
          <div
            className="mono"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(0,0,0,0.7)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Join the protocol.
          </div>
        </div>
      </div>

      {/* THE THREE ROLES */}
      <section style={{ padding: "80px 0" }}>
        <div className="paper-container">
          <div className="eyebrow" style={{ marginBottom: 32 }}>· Which ambassador are you?</div>

          <div className="tracks-3">
            {TRACKS.map((t) => (
              <div className="track-big" key={t.num}>
                <div className="head">
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: 14,
                    }}
                  >
                    Track {t.num}
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 72,
                      lineHeight: 1,
                      color: "var(--green)",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      opacity: 0.4,
                      marginBottom: -8,
                    }}
                  >
                    {t.num}
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 32,
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.05,
                      marginBottom: 14,
                    }}
                  >
                    {t.title}
                    <br />
                    {t.titleBreak}
                  </div>
                  <span className="paper-sticker" style={{ marginBottom: 12 }}>{t.sticker}</span>
                </div>
                <div className="body">
                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--ink-soft)",
                      lineHeight: 1.65,
                      margin: "8px 0 0",
                    }}
                  >
                    {t.body}
                  </p>
                </div>
                <div className="checks">
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    This is you if…
                  </div>
                  {t.bullets.map((b) => (
                    <div className="check-row" key={b}>
                      <span className="bullet" />
                      {b}
                    </div>
                  ))}
                </div>
                <Link href={t.applyHref} className="foot">
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--green-brand)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    Apply for this track
                  </span>
                  <span style={{ color: "var(--green-brand)", fontSize: 18 }}>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRESSION */}
      <section style={{ background: "var(--paper-2)", padding: "60px 0" }}>
        <div className="paper-container">
          <div className="eyebrow" style={{ marginBottom: 20 }}>· Program progression</div>
          <div className="prog-grid">
            {PROG.map((p) => {
              const peak = p.peak;
              return (
                <div
                  key={p.num}
                  style={{
                    background: peak ? "var(--ink)" : "var(--paper)",
                    border: peak ? "1px solid var(--ink)" : "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "18px 20px",
                    boxShadow: peak ? "2px 2px 0 var(--green-brand)" : "2px 2px 0 var(--ink)",
                    position: "relative",
                    color: peak ? "var(--paper)" : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: peak ? "var(--green-brand)" : "var(--green)",
                      position: "absolute",
                      top: 14,
                      right: 14,
                    }}
                  />
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: peak ? "var(--green-brand)" : "var(--green)",
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {p.num}
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      marginBottom: 6,
                      color: peak ? "var(--green-brand)" : undefined,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: peak ? "rgba(244,239,230,0.5)" : "var(--ink-mute)",
                      lineHeight: 1.4,
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          padding: "96px 0",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div className="paper-container">
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--green-brand)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <span style={{ width: 36, height: 1, background: "rgba(255,255,255,0.2)" }} />
            Next step
            <span style={{ width: 36, height: 1, background: "rgba(255,255,255,0.2)" }} />
          </div>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(40px, 7vw, 72px)",
              lineHeight: 1,
              letterSpacing: "-0.03em",
              fontWeight: 400,
              margin: "0 0 28px",
              color: "var(--paper)",
            }}
          >
            Know which track fits you?
            <br />
            <em style={{ color: "var(--green-brand)", fontStyle: "italic" }}>Read what it takes.</em>
          </h2>
          <div style={{ marginBottom: 18 }}>
            <Link
              href="/roles"
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                fontSize: 14,
                color: "var(--green-brand)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                textDecoration: "none",
                borderBottom: "1px solid rgba(0,255,157,0.3)",
                paddingBottom: 4,
              }}
            >
              Ambassador Roles & Responsibilities →
            </Link>
          </div>
          <Link
            href="/apply"
            className="paper-btn-primary"
            style={{
              background: "var(--green-brand)",
              color: "var(--ink)",
              fontSize: 16,
              padding: "18px 36px",
              marginTop: 18,
            }}
          >
            Start the application →
          </Link>
          <div
            className="mono"
            style={{
              marginTop: 22,
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Doc 02 // Full operational brief — all three tracks
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
