/**
 * Site-wide top navigation in the paper-palette v2 design.
 * On narrow screens the inline links collapse into a slide-down menu
 * instead of disappearing without a replacement.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type NavLink = { label: string; href: string };

const LINKS: NavLink[] = [
  { label: "Roles", href: "/roles" },
  { label: "XP", href: "/xp-system" },
  { label: "Badges", href: "/badges" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Dashboard", href: "/dashboard" },
];

export function SiteHeader() {
  const [location] = useLocation();
  const { isMobile, isTabletPortrait } = useBreakpoint();
  const isCompact = isMobile || isTabletPortrait;
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
        background: "color-mix(in oklab, var(--paper) 78%, transparent)",
        borderBottom: "1px solid var(--line)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div
        className="paper-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isCompact ? "12px 18px" : "16px 28px",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--ink)",
            minWidth: 0,
          }}
        >
          <img
            src={import.meta.env.VITE_LOGO_URL ?? "/favicon-192.png"}
            alt={import.meta.env.VITE_APP_NAME ?? "Ambassador Kit"}
            style={{ width: 32, height: 32, borderRadius: 8, display: "block", objectFit: "cover", flexShrink: 0 }}
          />
          <div
            className="serif"
            style={{
              fontSize: isCompact ? 17 : 19,
              letterSpacing: "-0.01em",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {import.meta.env.VITE_APP_NAME ?? "Ambassadors"}
          </div>
        </Link>

        {!isCompact && (
          <nav
            style={{ display: "flex", gap: 28, alignItems: "center" }}
            aria-label="Primary"
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 14,
                  color: isActive(l.href) ? "var(--ink)" : "var(--ink-soft)",
                  fontWeight: isActive(l.href) ? 600 : 400,
                  textDecoration: "none",
                }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/apply"
              className="paper-btn-primary"
              style={{ padding: "10px 18px", fontSize: 14 }}
            >
              Apply ↗
            </Link>
          </nav>
        )}

        {isCompact && (
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              color: "var(--ink)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-grid",
                gridTemplateRows: "2px 2px 2px",
                gap: 4,
                width: 16,
              }}
            >
              <span
                style={{
                  background: "var(--ink)",
                  height: 2,
                  transition: "transform .18s",
                  transform: open ? "translateY(6px) rotate(45deg)" : "none",
                }}
              />
              <span
                style={{
                  background: "var(--ink)",
                  height: 2,
                  opacity: open ? 0 : 1,
                  transition: "opacity .18s",
                }}
              />
              <span
                style={{
                  background: "var(--ink)",
                  height: 2,
                  transition: "transform .18s",
                  transform: open ? "translateY(-6px) rotate(-45deg)" : "none",
                }}
              />
            </span>
            {open ? "Close" : "Menu"}
          </button>
        )}
      </div>

      {isCompact && (
        <div
          aria-hidden={!open}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 49,
            pointerEvents: open ? "auto" : "none",
            background: open ? "rgba(20,20,15,0.42)" : "transparent",
            transition: "background .2s",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              background: "var(--paper)",
              borderBottom: "1px solid var(--line)",
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)",
              paddingBottom: 24,
              transform: open ? "translateY(0)" : "translateY(-12px)",
              opacity: open ? 1 : 0,
              transition: "transform .22s ease, opacity .18s ease",
            }}
          >
            <div className="paper-container" style={{ padding: "12px 20px 0" }}>
              <nav aria-label="Primary" style={{ display: "grid", gap: 4 }}>
                {LINKS.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 4px",
                        borderBottom: "1px solid var(--line)",
                        textDecoration: "none",
                        color: active ? "var(--ink)" : "var(--ink-soft)",
                        fontFamily: "'Fraunces', serif",
                        fontSize: 22,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span>{l.label}</span>
                      <span
                        aria-hidden
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        ↗
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/apply"
                className="paper-btn-primary"
                style={{
                  marginTop: 20,
                  width: "100%",
                  justifyContent: "center",
                  padding: "16px 18px",
                  fontSize: 15,
                }}
              >
                Apply ↗
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
