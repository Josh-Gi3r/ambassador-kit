import { useEffect, useCallback, useState } from "react";
import { useLocation } from "wouter";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

const SESSION_KEY = "ambassador_popup_seen";

interface WelcomePopupProps {
  onClose: () => void;
}

const PRINCIPLES = [
  {
    num: "01",
    title: "Start as a Contributor",
    body: "Everyone begins by contributing to the ecosystem.",
  },
  {
    num: "02",
    title: "Earn the Ambassador Title",
    body: "Ambassador status is earned over time through consistent contribution.",
  },
  {
    num: "03",
    title: "Build Real Impact",
    body: "Community operators, builders, and creators help bring the protocol into real networks.",
  },
];

export default function WelcomePopup({ onClose }: WelcomePopupProps) {
  const [, navigate] = useLocation();

  const handleExplore = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "true");
    onClose();
    navigate("/");
  }, [onClose, navigate]);

  // ESC redirects to /
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleExplore();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleExplore]);

  // Trap focus inside modal
  useEffect(() => {
    const focusable = document.querySelectorAll<HTMLElement>(
      "#welcome-popup button, #welcome-popup a, #welcome-popup [tabindex]"
    );
    if (focusable.length) focusable[0].focus();
  }, []);

  // Prevent body scroll while popup is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isMobile = useIsMobile();

  return (
    /* Overlay — full viewport, flex column so card never overflows */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wp-title"
      onClick={handleExplore}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: isMobile ? 0 : "24px",
      }}
    >
      {/* Modal card — scrollable inner content, CTA always pinned at bottom */}
      <div
        id="welcome-popup"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: isMobile ? "92dvh" : "85vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(10,10,10,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: isMobile ? "4px 4px 0 0" : "4px",
          boxShadow: isMobile ? "0 -8px 48px rgba(0,0,0,0.6)" : "0 24px 80px rgba(0,0,0,0.8)",
          fontFamily: "'Space Grotesk', sans-serif",
          color: "#fff",
          position: "relative",
        }}
      >
        {/* Neon top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "#00FF9D",
            borderRadius: "4px 4px 0 0",
            flexShrink: 0,
          }}
        />

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "40px 28px 0",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 19.5,
              fontWeight: 400,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#00FF9D",
              marginBottom: 18,
            }}
          >
            YOUR PROTOCOL // AMBASSADOR PROGRAM
          </div>

          {/* Title */}
          <h2
            id="wp-title"
            style={{
              fontSize: "clamp(20px, 5vw, 26px)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              margin: "0 0 20px",
              color: "#fff",
            }}
          >
            Welcome to the<br />Ambassador Program
          </h2>

          {/* Intro */}
          <p
            style={{
              fontSize: 21,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)",
              margin: "0 0 8px",
            }}
          >
            If you're here, you likely already understand what this protocol is building.
          </p>
          <p
            style={{
              fontSize: 21,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)",
              margin: "0 0 28px",
            }}
          >
            This program exists for people who want to help bring on-chain FX into the real world.
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 24 }} />

          {/* Principles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
            {PRINCIPLES.map((p) => (
              <div key={p.num} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 19.5,
                    fontWeight: 700,
                    color: "#00FF9D",
                    letterSpacing: "0.08em",
                    minWidth: 22,
                    paddingTop: 2,
                    flexShrink: 0,
                  }}
                >
                  {p.num}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 19.5,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: "#fff",
                      marginBottom: 3,
                      textTransform: "uppercase",
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: 19.5,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 20 }} />

          {/* Closing line */}
          <p
            style={{
              fontSize: 19.5,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.4)",
              margin: "0 0 4px",
              fontStyle: "italic",
            }}
          >
            Take a moment to understand how the program works before starting the application.
          </p>
        </div>

        {/* CTA — pinned at bottom, never scrolls away */}
        <div style={{ padding: "20px 28px 28px", flexShrink: 0 }}>
          <button
            onClick={handleExplore}
            style={{
              display: "block",
              width: "100%",
              padding: "15px 24px",
              background: "#00FF9D",
              color: "#000",
              border: "none",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 19.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Explore the Program →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns true if the popup has already been seen this session */
export function popupAlreadySeen(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}
