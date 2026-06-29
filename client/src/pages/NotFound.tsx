import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        className="paper-noise"
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
          padding: "80px 24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--green)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            · Error 404
          </div>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(96px, 18vw, 200px)",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 400,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            4<em style={{ color: "var(--green)", fontStyle: "italic" }}>0</em>4
          </h1>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              margin: "18px 0 16px",
            }}
          >
            The page you're looking for isn't here.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--ink-soft)",
              lineHeight: 1.65,
              margin: "0 auto 36px",
              maxWidth: 440,
            }}
          >
            It may have moved, been renamed, or just never existed. Either
            way — let's get you back to somewhere useful.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/" className="paper-btn-primary">
              ← Back home
            </Link>
            <Link href="/leaderboard" className="paper-btn-ghost">
              See the leaderboard
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
