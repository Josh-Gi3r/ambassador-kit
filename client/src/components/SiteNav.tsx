import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const APP_LOGO_URL = (import.meta.env.VITE_CDN_BASE ?? "") + "/logo.png"; // set VITE_CDN_BASE in .env

export function SiteNav() {
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  const links = [
    { path: "/leaderboard", label: "Leaderboard" },
    { path: "/dashboard", label: "My Dashboard" },
    { path: "/roles", label: "Roles" },
    { path: "/xp", label: "XP System" },
    { path: "/badges", label: "Badges" },
    { path: "/apply", label: "Apply" },
  ];

  return (
    <>
      <nav style={{
        background: "#000", borderBottom: "1px solid #111",
        padding: isMobile ? "10px 20px" : "10px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none", border: "none",
            cursor: "pointer", padding: 0, flexShrink: 0,
            display: "flex", alignItems: "center",
          }}
        >
          <img
            src={APP_LOGO_URL}
            alt="Protocol Logo"
            style={{ height: isMobile ? 28 : 34, width: "auto", display: "block" }}
          />
        </button>

        {/* Desktop nav links */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {links.map(({ path, label }) => {
              const active = location === path || location.startsWith(path + "/");
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    color: active ? "#00FF9D" : "#bbb",
                    background: active ? "rgba(0,255,157,0.08)" : "none",
                    border: active ? "1px solid rgba(0,255,157,0.3)" : "none",
                    padding: active ? "6px 14px" : "6px 0",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#ccc"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#bbb"; }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile hamburger button */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px", display: "flex", flexDirection: "column",
              gap: 5, alignItems: "center", justifyContent: "center",
            }}
          >
            <span style={{
              display: "block", width: 22, height: 2, background: menuOpen ? "#00FF9D" : "#bbb",
              transition: "transform 0.2s, opacity 0.2s",
              transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
            }} />
            <span style={{
              display: "block", width: 22, height: 2, background: menuOpen ? "#00FF9D" : "#bbb",
              opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s",
            }} />
            <span style={{
              display: "block", width: 22, height: 2, background: menuOpen ? "#00FF9D" : "#bbb",
              transition: "transform 0.2s, opacity 0.2s",
              transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
            }} />
          </button>
        )}
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "fixed", top: 49, left: 0, right: 0, zIndex: 99,
          background: "#000", borderBottom: "1px solid #1a1a1a",
          display: "flex", flexDirection: "column",
        }}>
          {links.map(({ path, label }) => {
            const active = location === path || location.startsWith(path + "/");
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  color: active ? "#00FF9D" : "#bbb",
                  background: active ? "rgba(0,255,157,0.06)" : "none",
                  border: "none", borderBottom: "1px solid #111",
                  padding: "16px 20px", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  textAlign: "left",
                }}
              >
                {active && <span style={{ color: "#00FF9D", marginRight: 8 }}>›</span>}
                {label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
