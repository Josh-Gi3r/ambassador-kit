import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type StepProps = {
  href: string;
  num: string;
  icon: string;
  label: string;
  variant?: "default" | "tg" | "x" | "xp";
  external?: boolean;
  internal?: boolean;
};

function StepBtn({ href, num, icon, label, variant = "default", external, internal }: StepProps) {
  const variants: Record<string, React.CSSProperties> = {
    default: { background: "var(--paper)", color: "var(--ink)", borderColor: "var(--line)" },
    tg: { background: "#0088cc", color: "#fff", borderColor: "#0088cc" },
    x: { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" },
    xp: { background: "rgba(0,200,134,0.06)", color: "var(--green)", borderColor: "rgba(0,200,134,0.4)" },
  };
  const numStyle: Record<string, React.CSSProperties> = {
    default: { background: "var(--paper-2)", color: "var(--ink-mute)" },
    tg: { background: "rgba(255,255,255,0.2)", color: "#fff" },
    x: { background: "rgba(255,255,255,0.1)", color: "var(--paper)" },
    xp: { background: "rgba(0,200,134,0.15)", color: "var(--green)" },
  };
  const v = variants[variant];
  const ns = numStyle[variant];

  const inner = (
    <>
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          ...ns,
        }}
      >
        {num}
      </span>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span>{label}</span>
      <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 16 }}>→</span>
    </>
  );
  const className = "paper-step-btn";
  const baseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: "18px 24px",
    border: "1px solid",
    borderRadius: 10,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    fontWeight: 500,
    transition: "transform .15s, border-color .15s",
    ...v,
  };
  if (internal) {
    return (
      <Link href={href} className={className} style={baseStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={className}
      style={baseStyle}
    >
      {inner}
    </a>
  );
}

export default function ApplySuccess() {
  return (
    <>
      <SiteHeader />
      <style>{`
        @media (max-width: 480px) {
          .apply-success-container { padding: 48px 16px 64px !important; }
          .paper-step-btn { padding: 14px 16px !important; gap: 10px !important; font-size: 15px !important; }
          .paper-step-btn span:nth-child(2) { font-size: 16px !important; }
        }
      `}</style>
      <div className="apply-success-container" style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span className="paper-sticker" style={{ marginBottom: 18 }}>
            ★ Application submitted
          </span>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(44px, 8vw, 72px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              fontWeight: 400,
              margin: "18px 0 20px",
            }}
          >
            You're in the
            <br />
            <em style={{ color: "var(--green)", fontStyle: "italic" }}>pipeline.</em>
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "var(--ink-soft)",
              margin: "0 auto",
              maxWidth: 460,
              lineHeight: 1.65,
            }}
          >
            Your application is received. While we review it, here is what to do right now.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
          <StepBtn variant="tg" external href={import.meta.env.VITE_TELEGRAM_URL ?? "#"} num="01" icon="✈" label="Join the Telegram" />
          <StepBtn variant="x" external href={import.meta.env.VITE_X_URL ?? "https://x.com"} num="02" icon="𝕏" label="Follow on X" />
          <StepBtn
            variant="x"
            external
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Just applied to become an Ambassador! Check out the leaderboard: " + (import.meta.env.VITE_APP_BASE_URL ?? "") + "/leaderboard")}`}
            num="03"
            icon="↗"
            label="Share that you applied"
          />
          <StepBtn internal href="/leaderboard" num="04" icon="⊿" label="Check the leaderboard" />
          <StepBtn internal variant="xp" href="/xp-system" num="05" icon="◎" label="Learn how XP is earned" />
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 28, textAlign: "center" }}>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-mute)",
              lineHeight: 1.6,
              margin: "0 0 20px",
            }}
          >
            Pass the knowledge test and you are automatically an L1 Contributor — your profile appears on the leaderboard straight away. XP updates continuously as you post and engage. The team reviews applications and approves Ambassadors (L2).
          </p>
          <Link
            href="/"
            className="ulink mono"
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Back to home
          </Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
