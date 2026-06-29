import type { ReactElement } from "react";
import { Link, useLocation } from "wouter";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type Item = {
  href: string;
  label: string;
  icon: (active: boolean) => ReactElement;
  match?: (loc: string) => boolean;
};

function Icon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Home",
    icon: (a) => <Icon active={a} d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    match: (l) => l === "/",
  },
  {
    href: "/leaderboard",
    label: "Board",
    icon: (a) => <Icon active={a} d="M4 20h16M7 20V9m5 11V4m5 16v-7" />,
  },
  {
    href: "/apply",
    label: "Apply",
    icon: (a) => <Icon active={a} d="M12 5v14M5 12h14" />,
  },
  {
    href: "/dashboard",
    label: "Me",
    icon: (a) => <Icon active={a} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  },
  {
    href: "/roles",
    label: "More",
    icon: (a) => <Icon active={a} d="M4 6h16M4 12h16M4 18h16" />,
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { isMobile, isTabletPortrait, isStandalone } = useBreakpoint();

  if (!isMobile && !isTabletPortrait) return null;

  const isActive = (it: Item) =>
    it.match ? it.match(location) : location === it.href || location.startsWith(it.href + "/");

  return (
    <>
      <div style={{ height: `calc(64px + env(safe-area-inset-bottom, 0px))` }} aria-hidden />
      <nav
        role="navigation"
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          background: "color-mix(in oklab, var(--paper) 92%, transparent)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          borderTop: "1px solid var(--line)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
            margin: 0,
            padding: "6px 4px 4px",
            listStyle: "none",
            maxWidth: 640,
            marginInline: "auto",
          }}
        >
          {ITEMS.map((it) => {
            const active = isActive(it);
            const isCenter = it.label === "Apply";
            return (
              <li key={it.href} style={{ display: "flex", justifyContent: "center" }}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: "6px 2px",
                    minHeight: 52,
                    width: "100%",
                    textDecoration: "none",
                    color: active ? "var(--ink)" : "var(--ink-mute)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {isCenter ? (
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        background: "var(--ink)",
                        color: "var(--paper)",
                        marginTop: -10,
                        boxShadow: "0 6px 14px rgba(20,20,15,0.18)",
                      }}
                    >
                      {it.icon(true)}
                    </span>
                  ) : (
                    <span style={{ color: active ? "var(--green)" : "var(--ink-mute)" }}>
                      {it.icon(active)}
                    </span>
                  )}
                  <span>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {isStandalone ? null : null}
      </nav>
    </>
  );
}
