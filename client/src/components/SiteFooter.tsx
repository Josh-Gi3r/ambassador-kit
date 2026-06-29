/**
 * Site-wide footer in the paper-palette v2 design.
 */
import { Link } from "wouter";

type FooterLink = { label: string; href: string; external?: boolean };

const PROGRAM_LINKS: FooterLink[] = [
  { label: "Apply", href: "/apply" },
  { label: "Choose your track", href: "/ambassador" },
  { label: "Roles", href: "/roles" },
];
const SYSTEM_LINKS: FooterLink[] = [
  { label: "XP system", href: "/xp-system" },
  { label: "Badges", href: "/badges" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "AI Creator Studio", href: "/dashboard#studio" },
  { label: "Perks Vault", href: "/dashboard#perks" },
];
const PRINCIPLES = [
  "// 01  Merit before title. Contribution before recognition.",
  "// 02  Community before promotion. Relationships before reach.",
  "// 03  Opportunity through contribution. The program builds the pipeline.",
  "// 04  Quality over scale. A small founding cohort done right.",
];

function FooterCol({
  title,
  links,
  linksRaw,
}: {
  title: string;
  links?: FooterLink[];
  linksRaw?: string[];
}) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links?.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            style={{
              fontSize: 15,
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            {l.label}
          </Link>
        ))}
        {linksRaw?.map((t, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.55,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ padding: "60px 0 32px", background: "var(--paper)" }}>
      <div className="paper-container">
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <img
                src={import.meta.env.VITE_LOGO_URL ?? "/favicon-192.png"}
                alt={import.meta.env.VITE_APP_NAME ?? "Ambassador Kit"}
                style={{ width: 32, height: 32, borderRadius: 8, display: "block", objectFit: "cover" }}
              />
              <div className="serif" style={{ fontSize: 20, fontWeight: 500 }}>
                {import.meta.env.VITE_APP_NAME ?? "Ambassador Kit"}
              </div>
            </div>
            <p
              className="serif"
              style={{
                fontSize: 24,
                fontStyle: "italic",
                lineHeight: 1.3,
                margin: "0 0 18px",
                maxWidth: 360,
                fontWeight: 400,
              }}
            >
              {import.meta.env.VITE_FOOTER_TAGLINE ?? "Your community. Your program."}
            </p>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                letterSpacing: "0.08em",
              }}
            >
              {import.meta.env.VITE_APP_DOMAIN ?? "yourprotocol.xyz"}
            </div>
          </div>
          <FooterCol title="The program" links={PROGRAM_LINKS} />
          <FooterCol title="The system" links={SYSTEM_LINKS} />
          <FooterCol title="Principles" linksRaw={PRINCIPLES} />
        </div>

        <div
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              letterSpacing: "0.06em",
            }}
          >
            {new Date().getFullYear()} {import.meta.env.VITE_APP_NAME ?? "Ambassador Kit"}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {["X", "Telegram", "Docs"].map((l) => (
              <a
                key={l}
                href="#"
                style={{
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  textDecoration: "none",
                }}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </footer>
  );
}
