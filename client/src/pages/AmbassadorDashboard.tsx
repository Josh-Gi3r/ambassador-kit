import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { PerksTab } from "@/components/PerksTab";
import { AIStudioTab } from "@/components/AIStudioTab";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const LEVEL_NAMES = ["Applicant", "Contributor", "Ambassador", "Lead", "Ecosystem Lead", "Full-Time"];
const TRACK_LABELS: Record<string, string> = { community: "COMMUNITY", developer: "DEVELOPER", content: "CONTENT" };
const _CDN = import.meta.env.VITE_CDN_BASE ?? "";
const BADGE_META: Record<string, { icon: string; label: string; tier: string; desc: string }> = {
  l1_contributor:  { icon: `${_CDN}/badge-placeholder.png`,  label: "L1 Contributor",   tier: "Steel",  desc: "You passed the knowledge test and are an L1 Contributor in the program. The program team approves Ambassadors (L2)." },
  l2_ambassador:   { icon: `${_CDN}/badge-placeholder.png`,   label: "L2 Ambassador",    tier: "Gold",   desc: "You have earned enough XP to unlock permanent perks, tools, and access that L1s do not get." },
  evangelist:      { icon: `${_CDN}/badge-placeholder.png`,      label: "Evangelist",       tier: "Gold",   desc: "Only 12 slots. Hand-picked by the program team. Evangelists get flown out to represent the protocol at major industry events." },
  steady_hand:     { icon: `${_CDN}/badge-placeholder.png`,     label: "Steady Hand",      tier: "Bronze", desc: "You are posting about the protocol on 4-5 days out of every 14 and keeping a real rhythm going." },
  iron_rhythm:     { icon: `${_CDN}/badge-placeholder.png`,     label: "Iron Rhythm",      tier: "Silver", desc: "You are posting 9+ days out of every 14. Almost daily. Most people cannot keep this up." },
  wordsmith:       { icon: `${_CDN}/badge-placeholder.png`,       label: "Wordsmith",        tier: "Bronze", desc: "You are writing posts that actually teach people something about the protocol, and the team has noticed." },
  viral_voice:     { icon: `${_CDN}/badge-placeholder.png`,     label: "Viral Voice",      tier: "Silver", desc: "You are consistently active in the protocol conversation — replying, quoting, and engaging with community content." },
  shipper:         { icon: `${_CDN}/badge-placeholder.png`,         label: "Shipper",          tier: "Bronze", desc: "You built something real for the the ecosystem and got it out the door." },
  architect:       { icon: `${_CDN}/badge-placeholder.png`,       label: "Architect",        tier: "Gold",   desc: "What you shipped is exceptional and other people are already referencing it or building on top of it." },
  first_responder: { icon: `${_CDN}/badge-placeholder.png`, label: "First Responder",  tier: "Bronze", desc: "You are the one answering questions in Telegram before anyone else and helping newcomers find their footing." },
  community_pillar:{ icon: `${_CDN}/badge-placeholder.png`,label: "Community Pillar", tier: "Silver", desc: "Other ambassadors actively come to you for answers because you know the protocol and you know how to explain it." },
  sharp:           { icon: `${_CDN}/badge-placeholder.png`,           label: "Sharp",            tier: "Steel",  desc: "You scored 8 or higher on the knowledge test, which means you came in already understanding the protocol." },
  perfect:         { icon: `${_CDN}/badge-placeholder.png`,         label: "Perfect",          tier: "Gold",   desc: "You got every single question right. 10 out of 10. That almost never happens." },
  rising:          { icon: `${_CDN}/badge-placeholder.png`,          label: "Rising",           tier: "Silver", desc: "Your XP has gone up three weeks in a row and everyone on the leaderboard can see the streak." },

};

const NEXT_LEVEL_REQUIREMENTS: Record<number, string[]> = {
  0: ["Submit your application", "Pass the knowledge test"],
  1: ["Post consistently about the protocol on X for 3+ weeks", "Engage with other ambassadors' content", "Be active in the the Telegram community community"],
  2: ["Lead a community initiative or event", "Onboard at least 2 new contributors", "Demonstrate measurable impact in your region"],
  3: ["Build a regional ambassador network", "Drive measurable adoption or partnerships", "Represent the program at industry events"],
  4: ["Transition to full-time role at the organization", "Proven track record across all dimensions"],
};

const XP_COMPONENTS = [
  { key: "xpC1",  code: "C1",  label: "Post Output",       max: 12, color: "#00C886", icon: "📝" },
  { key: "xpC2",  code: "C2",  label: "Posting Spread",    max: 10, color: "#00C886", icon: "🔄" },
  { key: "xpC3",  code: "C3",  label: "X Engagement",      max: 14, color: "#4D80D0", icon: "💬" },
  { key: "xpC4",  code: "C4",  label: "Content Quality",   max: 12, color: "#b58e1d", icon: "⭐" },
  { key: "xpC5",  code: "C5",  label: "TG Participation",  max: 8,  color: "#3FA0C8", icon: "💬" },
  { key: "xpC6",  code: "C6",  label: "Community Value",   max: 10, color: "#D87A30", icon: "🤝" },
  { key: "xpC7",  code: "C7",  label: "Builder Output",    max: 8,  color: "#8A5BD0", icon: "🔨" },
  { key: "xpC8",  code: "C8",  label: "Builder Depth",     max: 6,  color: "#7050BF", icon: "🏗" },
  { key: "xpC9",  code: "C9",  label: "Authenticity",      max: 8,  color: "#C84C3E", icon: "🎯" },
  { key: "xpC10", code: "C10", label: "Mission Alignment", max: 7,  color: "#D89B3E", icon: "🎖" },
  { key: "xpC11", code: "C11", label: "Application",       max: 5,  color: "#3690C0", icon: "📋" },
];

const SUBMISSION_TYPES = [
  { value: "integration", label: "Integration" },
  { value: "repository",  label: "Repository" },
  { value: "article",     label: "Article" },
  { value: "tutorial",    label: "Tutorial" },
  { value: "event",       label: "Event" },
  { value: "introduction",label: "Introduction" },
  { value: "translation", label: "Translation" },
  { value: "bug_report",  label: "Bug Report" },
  { value: "other",       label: "Other" },
];

function getTracks(tracks: unknown): string[] {
  if (Array.isArray(tracks)) return tracks as string[];
  if (typeof tracks === "string") { try { return JSON.parse(tracks); } catch { return [tracks]; } }
  return [];
}
function calcTotalXP(app: Record<string, unknown>): number {
  return ["xpC1","xpC2","xpC3","xpC4","xpC5","xpC6","xpC7","xpC8","xpC9","xpC10","xpC11"]
    .reduce((s, k) => s + Number(app[k] ?? 0), 0);
}
function pfpUrl(_handle: string | null | undefined, avatarUrl: string | null | undefined): string {
  // Only use avatarUrl from DB — never fall back to third-party scrapers
  if (avatarUrl) return avatarUrl;
  return "";
}

// ── XP Radar (paper-palette SVG, mirrors Dashboard.html drawRadar) ──────────
function PaperRadar({ app }: { app: Record<string, unknown> }) {
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const r = 130;
  const N = XP_COMPONENTS.length;
  const angleStep = (Math.PI * 2) / N;
  const rings = 4;
  const ringPolygons: string[] = [];
  for (let i = 1; i <= rings; i++) {
    const rr = (r * i) / rings;
    let pts = "";
    for (let j = 0; j < N; j++) {
      const ang = j * angleStep - Math.PI / 2;
      pts += `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)} `;
    }
    ringPolygons.push(pts);
  }
  const axes = [];
  for (let j = 0; j < N; j++) {
    const ang = j * angleStep - Math.PI / 2;
    axes.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  let dataPts = "";
  const dots: { x: number; y: number; color: string }[] = [];
  for (let j = 0; j < N; j++) {
    const c = XP_COMPONENTS[j];
    const v = Math.min(1, Number(app[c.key] ?? 0) / c.max);
    const rr = r * v;
    const ang = j * angleStep - Math.PI / 2;
    const x = cx + rr * Math.cos(ang);
    const y = cy + rr * Math.sin(ang);
    dataPts += `${x},${y} `;
    dots.push({ x, y, color: c.color });
  }
  const labels = XP_COMPONENTS.map((c, j) => {
    const ang = j * angleStep - Math.PI / 2;
    const lx = cx + (r + 22) * Math.cos(ang);
    const ly = cy + (r + 22) * Math.sin(ang);
    let anchor: "start" | "middle" | "end" = "middle";
    if (Math.cos(ang) > 0.3) anchor = "start";
    else if (Math.cos(ang) < -0.3) anchor = "end";
    return { x: lx, y: ly, anchor, code: c.code };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 460 }} preserveAspectRatio="xMidYMid meet">
      {ringPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {axes.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="var(--line)" strokeWidth={1} />
      ))}
      <polygon points={dataPts} fill="rgba(0,200,134,0.18)" stroke="var(--green)" strokeWidth={2} strokeLinejoin="round" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={4} fill={d.color} stroke="var(--paper)" strokeWidth={1.5} />
      ))}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          fontFamily="'JetBrains Mono', monospace"
          fontSize={10}
          fill="var(--ink-mute)"
          textAnchor={l.anchor}
          dominantBaseline="middle"
          letterSpacing="0.08em"
          fontWeight={700}
        >
          {l.code}
        </text>
      ))}
    </svg>
  );
}

type JournalEntry = {
  id: number;
  applicationId: number;
  entryType: string;
  title: string;
  content: string;
  createdAt: Date | number;
  updatedAt: Date | number;
};

function JournalSection({ applicationId, mode = "journal" }: { applicationId: number; mode?: "journal" | "plan" }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: entries = [], refetch } = trpc.journal.list.useQuery({ applicationId });
  const createMutation = trpc.journal.create.useMutation({ onSuccess: () => { refetch(); setIsCreating(false); setTitle(""); setContent(""); } });
  const updateMutation = trpc.journal.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); setTitle(""); setContent(""); } });
  const deleteMutation = trpc.journal.delete.useMutation({ onSuccess: () => refetch() });

  const filtered = entries.filter((e: JournalEntry) => e.entryType === mode);

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return;
    createMutation.mutate({ applicationId, entryType: mode, title: title.trim(), content: content.trim() });
  };

  const handleUpdate = (id: number) => {
    if (!title.trim() || !content.trim()) return;
    updateMutation.mutate({ id, applicationId, title: title.trim(), content: content.trim() });
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setTitle("");
    setContent("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div className="panel-section-h" style={{ margin: 0 }}>
          {mode === "journal" ? "Journal · Private to you" : "Plans · Accountability roadmap"}
        </div>
        {!isCreating && editingId === null && (
          <button className="btn-add" onClick={() => { setIsCreating(true); setTitle(""); setContent(""); }}>
            + New {mode === "journal" ? "entry" : "plan"}
          </button>
        )}
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 18px", lineHeight: 1.6 }}>
        {mode === "journal"
          ? "Document your progress, reflections, and learnings. Only you see this. The team can read it if you ask for feedback."
          : "Write your accountability plans. What you'll do to reach the next level. Be specific — what will you post, when, how many times? How will you help others?"}
      </p>

      {/* Create form */}
      {isCreating && (
        <div className="paper-form-card" style={{ marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            New {mode === "journal" ? "journal entry" : "accountability plan"}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === "journal" ? "Entry title…" : "Plan title (e.g. Week 3 Goals)"}
            className="paper-input"
            style={{ marginBottom: 10 }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={mode === "journal"
              ? "What did you do this week? What worked? What didn't? What will you do differently?"
              : "What is your plan to reach the next level? Be specific: what will you post, when, how many times? How will you help others?"
            }
            rows={6}
            className="paper-input"
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="paper-btn-primary" style={{ padding: "10px 20px", fontSize: 13 }} onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button className="paper-btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {filtered.length === 0 && !isCreating ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
            No {mode === "journal" ? "journal entries" : "plans"} yet
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>
            {mode === "journal"
              ? "Document your progress, reflections, and learnings here."
              : "Write your accountability plans: what you'll do to reach the next level."
            }
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((entry: JournalEntry) => (
            <div key={entry.id} className="paper-form-card">
              {editingId === entry.id ? (
                <div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="paper-input"
                    style={{ marginBottom: 10 }}
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="paper-input"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="paper-btn-primary" style={{ padding: "10px 20px", fontSize: 13 }} onClick={() => handleUpdate(entry.id)} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving…" : "Update"}
                    </button>
                    <button className="paper-btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>{entry.title}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4, letterSpacing: "0.06em" }}>
                        {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => startEdit(entry)} className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: 0 }}>Edit</button>
                      <button onClick={() => deleteMutation.mutate({ id: entry.id, applicationId })} className="mono" style={{ fontSize: 11, color: "#c14b3a", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: 0 }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{entry.content}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PUBLIC PROFILE VIEW (for viewing others) ─────────────────────────────────
function PublicProfileView({ id }: { id: number }) {
  const { data: profile, isLoading } = trpc.ambassador.publicProfile.useQuery({ id });
  const [, navigate] = useLocation();

  if (isLoading) return (
    <>
      <SiteHeader />
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Loading profile…</div>
      </div>
      <SiteFooter />
    </>
  );

  if (!profile) return (
    <>
      <SiteHeader />
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 16 }}>Profile not found</div>
          <button onClick={() => navigate("/leaderboard")} className="paper-btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }}>← Back to Leaderboard</button>
        </div>
      </div>
      <SiteFooter />
    </>
  );

  const p = profile as any;
  const handle = p.displayHandle || p.twitterHandle || p.telegramHandle || `Ambassador #${id}`;
  const tracks = Array.isArray(p.tracks) ? p.tracks as string[] : [];
  const badges = Array.isArray(p.badges) ? p.badges as string[] : [];
  const level = p.level ?? 0;
  const lifetime = Number(p.lifetimeXp ?? 0);
  const d30 = Number(p.xp30day ?? 0);
  const founding = Number(p.isFounding ?? 0) === 1;
  const tier: string = founding ? "Founding" : (p.currentTier ?? "initiate");
  const stepAt = p.tierStepDownAt ? new Date(p.tierStepDownAt) : null;
  const stepDays = stepAt ? Math.max(0, Math.ceil((stepAt.getTime() - Date.now()) / 86_400_000)) : null;
  const cleanHandle = handle.replace(/^@/, "");
  const initials = cleanHandle.slice(0, 2).toUpperCase();
  const isEvangelist = p.evangelistCandidate === 1;
  const avatar = pfpUrl(handle, p.avatarUrl as string | null);

  return (
    <>
      <SiteHeader />
      <style>{`
        .public-hero { padding: 56px 0 32px; }
        .public-grid { display: grid; grid-template-columns: 96px 1fr auto; gap: 24px; align-items: start; }
        @media (max-width: 720px) { .public-grid { grid-template-columns: 64px 1fr; gap: 16px; } .public-xp { grid-column: 1 / -1; padding-top: 12px; border-top: 1px solid var(--line); } }
        .public-avatar { width: 96px; height: 96px; border-radius: 50%; background: var(--paper); border: 2px solid var(--ink); display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: var(--green); position: relative; overflow: visible; }
        .public-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .public-avatar.evangelist::after { content: "⚡"; position: absolute; bottom: -4px; right: -4px; width: 28px; height: 28px; background: #d6a017; border-radius: 50%; border: 2px solid var(--paper); display: grid; place-items: center; font-size: 14px; color: var(--ink); z-index: 2; }
        .public-handle { font-family: 'Inter', sans-serif; font-size: clamp(32px, 5vw, 48px); font-weight: 700; letter-spacing: -0.02em; color: var(--ink); line-height: 1; margin: 0 0 14px; }
        .meta-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; border: 1px solid var(--green); color: var(--green); padding: 4px 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; }
        .meta-badge.evangelist { border-color: #d6a017; color: #d6a017; background: rgba(214,160,23,0.06); }
      `}</style>

      <div className="paper-container public-hero">
        <header className="public-grid">
          <div className={`public-avatar${isEvangelist ? " evangelist" : ""}`}>
            {avatar ? <img src={avatar} alt={handle} /> : <span>{initials}</span>}
          </div>
          <div>
            <h1 className="public-handle">@{cleanHandle}</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 14, color: "var(--ink-soft)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                L{level} // {LEVEL_NAMES[Math.min(level, 5)]}
              </span>
              {isEvangelist && <span className="meta-badge evangelist">⚡ Evangelist</span>}
              {tracks.map(t => <span key={t} className="meta-badge">{TRACK_LABELS[t] ?? t}</span>)}
            </div>
          </div>
          <div className="public-xp" style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 700, color: "var(--green)", lineHeight: 0.9, letterSpacing: "-0.02em" }}>
              {lifetime.toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 6 }}>Lifetime XP</div>
          </div>
        </header>

        {/* Snapshot panel */}
        <div className="panel-section" style={{ marginTop: 24 }}>
          <div className="panel-section-h">Snapshot</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 20 }}>
            <div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>{lifetime.toLocaleString()}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Lifetime XP</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}>{d30.toLocaleString()}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>30-day XP</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: founding ? "#d6a017" : "#7e5ad1" }}>{tier.toUpperCase()}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Current tier</div>
            </div>
          </div>
          {stepDays !== null && (
            <div className="callout warn" style={{ marginTop: 22 }}>
              Your {String(tier).toUpperCase()} access pauses in {stepDays} day{stepDays === 1 ? "" : "s"} unless you post — your Lifetime XP and record are untouched.
            </div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="panel-section" style={{ marginTop: 24 }}>
          <div className="panel-section-h">XP Breakdown</div>
          <div className="xp-grid-2">
            {XP_COMPONENTS.map((c) => {
              const val = Number(p[c.key] ?? 0);
              const pct = Math.min(100, Math.round((val / c.max) * 100));
              return (
                <div key={c.key} className="xp-card">
                  <div className="head">
                    <div className="lbl-wrap">
                      <span className="icon">{c.icon}</span>
                      <span className="label">{c.label}</span>
                    </div>
                    <div className="val" style={{ color: c.color }}>{val.toFixed(1)}<small>/{c.max}</small></div>
                  </div>
                  <div className="bar"><div style={{ width: `${pct}%`, background: c.color }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="panel-section" style={{ marginTop: 24, marginBottom: 60 }}>
            <div className="panel-section-h">Badges earned</div>
            <div className="badges-grid">
              {badges.map((b) => {
                const meta = BADGE_META[b];
                if (!meta) return null;
                return (
                  <div key={b} className="badge-tile" title={meta.desc}>
                    <img src={meta.icon} alt={meta.label} />
                    <div className="nm">{meta.label}</div>
                    <div className="tier-l">{meta.tier} tier</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DashboardCSS />
      <SiteFooter />
    </>
  );
}

// ── TG + X MAPPING PANEL ────────────────────────────────────────────────────
function TelegramXMappingPanel({ applicationId: _applicationId }: { applicationId: number }) {
  const utils = trpc.useUtils();
  const [selectedTg, setSelectedTg] = useState<string>("");

  const { data: tgData, isLoading: tgLoading } = trpc.ambassador.myTelegramMapping.useQuery();
  const { data: xData, isLoading: xLoading } = trpc.ambassador.myXMapping.useQuery();

  const mapTgMutation = trpc.ambassador.mapTelegramSelf.useMutation({
    onSuccess: () => {
      utils.ambassador.myTelegramMapping.invalidate();
      utils.ambassador.myApplication.invalidate();
      setSelectedTg("");
    },
  });

  const tgMapped = tgData?.mapped ?? false;
  const xMapped = xData?.mapped ?? false;
  const unmatchedSenders = tgData?.unmatchedSenders ?? [];

  return (
    <div className="panel-section">
      <div className="panel-section-h">Activity tracking · Connect your accounts</div>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 0 12px" }}>
        Your XP from X (Twitter) and Telegram is scraped automatically. Make sure both are linked so your activity counts.
      </p>

      {/* Telegram row */}
      <div className="track-row">
        <div className="iconbox">✈</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="info-title">Telegram Activity</div>
          {tgLoading ? (
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)" }}>Loading…</div>
          ) : tgMapped ? (
            <div className="mono" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ color: "var(--green)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>✓ Mapped</span>
              <span style={{ color: "var(--ink-soft)" }}>as "{tgData?.displayName}"</span>
              <span style={{ color: "var(--ink-mute)" }}>·</span>
              <span style={{ color: "var(--ink-soft)" }}>{tgData?.messageCount} messages tracked</span>
            </div>
          ) : unmatchedSenders.length > 0 ? (
            <div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 10, lineHeight: 1.55 }}>
                Select your display name from the group chat to link your Telegram activity to your score.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedTg}
                  onChange={(e) => setSelectedTg(e.target.value)}
                  className="paper-input"
                  style={{ minWidth: 220, cursor: "pointer" }}
                >
                  <option value="">Select your name…</option>
                  {unmatchedSenders.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  disabled={!selectedTg || mapTgMutation.isPending}
                  onClick={() => selectedTg && mapTgMutation.mutate({ displayName: selectedTg })}
                  className="paper-btn-primary"
                  style={{ padding: "10px 18px", fontSize: 13, opacity: selectedTg ? 1 : 0.5, cursor: selectedTg ? "pointer" : "not-allowed" }}
                >
                  {mapTgMutation.isPending ? "Linking…" : "Link"}
                </button>
              </div>
              {mapTgMutation.isError && (
                <div className="mono" style={{ fontSize: 12, color: "#c14b3a", marginTop: 8 }}>
                  {mapTgMutation.error.message}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
              Your name wasn't found in the group chat yet — either you haven't posted, or the latest export hasn't been processed. Check back after the next update.
            </div>
          )}
        </div>
      </div>

      {/* X row */}
      <div className="track-row">
        <div className="iconbox x">𝕏</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="info-title">X (Twitter) Activity</div>
          {xLoading ? (
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)" }}>Loading…</div>
          ) : xMapped ? (
            <div className="mono" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ color: "var(--green)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>✓ Tracked</span>
              {xData?.twitterHandle && (
                <span style={{ color: "var(--ink-soft)" }}>@{xData.twitterHandle.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "").replace(/^@+/, "")}</span>
              )}
              <span style={{ color: "var(--ink-mute)" }}>·</span>
              <span style={{ color: "var(--ink-soft)" }}>{xData?.tweetCount} protocol-related posts</span>
              {xData?.lastScrapedAt && (
                <>
                  <span style={{ color: "var(--ink-mute)" }}>·</span>
                  <span style={{ color: "var(--ink-soft)" }}>Last scraped {new Date(xData.lastScrapedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                </>
              )}
            </div>
          ) : xData?.twitterHandle ? (
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
              Your X handle <span style={{ color: "var(--ink)" }}>@{xData.twitterHandle.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "").replace(/^@+/, "")}</span> is registered. No protocol-related posts found yet. Tag the official handle in your posts and we'll pick them up in the next scrape.
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
              No X handle on file. Make sure you submitted your X handle in your application.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TWEET CARD ────────────────────────────────────────────────────────────────
function TweetCard({ tweet }: { tweet: Record<string, unknown> }) {
  const text = (tweet.tweetText ?? tweet.text ?? "") as string;
  const likes = (tweet.likeCount ?? tweet.likes ?? 0) as number;
  const rts = (tweet.retweetCount ?? tweet.retweets ?? 0) as number;
  const replies = (tweet.replyCount ?? tweet.replies ?? 0) as number;
  const url = tweet.tweetUrl as string | undefined;
  return (
    <div className="tweet-card">
      <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 12 }}>
        {text.length > 200 ? text.slice(0, 200) + "…" : text}
      </div>
      <div className="mono" style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 12, color: "var(--ink-mute)" }}>
        <span>♡ {likes}</span>
        <span>↻ {rts}</span>
        <span>↩ {replies}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--green)", textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}>View →</a>}
      </div>
    </div>
  );
}

// ── SUBMISSION ROW ───────────────────────────────────────────────────────────
function SubmissionRow({ s, applicationId: _applicationId, onDelete }: { s: Record<string, unknown>; applicationId: number; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = SUBMISSION_TYPES.find(t => t.value === s.submissionType)?.label ?? String(s.submissionType);
  return (
    <div className="submission-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="info">
          <div className="ttl">{s.title as string}</div>
          <div className="meta">
            <span>{typeLabel}</span>
            {Boolean(s.submittedAt) && <span>Submitted {new Date(s.submittedAt as string).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => setExpanded(e => !e)} className="mono" style={{ background: "none", border: "none", fontSize: 11, color: "var(--green)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, padding: 0 }}>
            {expanded ? "Hide ▲" : "View →"}
          </button>
          <button onClick={() => onDelete(s.id as number)} style={{ background: "none", border: "none", color: "var(--ink-mute)", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 0 0", marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {s.description ? (
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>{String(s.description)}</div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ink-mute)", fontStyle: "italic" }}>No description provided.</div>
          )}
          {s.url ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Reference URL:</span>
              <a href={s.url as string} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, color: "var(--green)", textDecoration: "none", wordBreak: "break-all" }}>{s.url as string}</a>
            </div>
          ) : null}
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>
            Submitted: {s.submittedAt ? new Date(s.submittedAt as string).toLocaleDateString() : "—"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BUILDER SUBMISSIONS PANEL ─────────────────────────────────────────────────
function BuilderPanel({ applicationId }: { applicationId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: "", title: "", submissionType: "article", description: "" });
  const { data: submissions, refetch } = trpc.dashboard.builderSubmissions.useQuery({ applicationId });
  const submit = trpc.dashboard.submitBuilder.useMutation({ onSuccess: () => { refetch(); setShowForm(false); setForm({ url: "", title: "", submissionType: "article", description: "" }); } });
  const del = trpc.dashboard.deleteBuilder.useMutation({ onSuccess: () => refetch() });
  return (
    <div className="panel-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div className="panel-section-h" style={{ margin: 0 }}>Builder Submissions · C7 / C8</div>
        <button className="btn-add" onClick={() => setShowForm(!showForm)}>+ Add submission</button>
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 20px" }}>
        Log integrations, repos, articles, tutorials, events, and intros you've shipped for the protocol. Each submission is reviewed and scored toward Builder Output (C7) and Builder Depth (C8).
      </p>
      {showForm && (
        <div className="paper-form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="paper-input" />
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" className="paper-input" />
            <select value={form.submissionType} onChange={e => setForm(f => ({ ...f, submissionType: e.target.value }))} className="paper-input">
              {SUBMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={3} className="paper-input" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => submit.mutate({ applicationId, url: form.url, title: form.title, submissionType: form.submissionType as "article", description: form.description || undefined })}
                disabled={!form.url || !form.title || submit.isPending}
                className="paper-btn-primary"
                style={{ padding: "10px 20px", fontSize: 13, opacity: (!form.url || !form.title) ? 0.5 : 1 }}
              >
                {submit.isPending ? "Submitting…" : "Submit"}
              </button>
              <button onClick={() => setShowForm(false)} className="paper-btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {(!submissions || submissions.length === 0) && !showForm && (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
            No submissions yet
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>
            Add integrations, articles, or repos to earn C7/C8 XP.
          </div>
        </div>
      )}
      {submissions?.map((s: Record<string, unknown>) => (
        <SubmissionRow key={s.id as number} s={s} applicationId={applicationId} onDelete={(id) => del.mutate({ id, applicationId })} />
      ))}
    </div>
  );
}

// ── WALLET PANEL ──────────────────────────────────────────────────────────────
function WalletPanel({ applicationId, currentWallet }: { applicationId: number; currentWallet?: string | null }) {
  const [editing, setEditing] = useState(false);
  const [wallet, setWallet] = useState(currentWallet ?? "");
  const update = trpc.dashboard.updateWallet.useMutation({ onSuccess: () => setEditing(false) });
  return (
    <div className="panel-section">
      <div className="panel-section-h">Wallet Address</div>
      {editing ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x… or Solana address" className="paper-input" style={{ flex: 1, minWidth: 200 }} />
          <button onClick={() => update.mutate({ applicationId, walletAddress: wallet })} disabled={!wallet || update.isPending} className="paper-btn-primary" style={{ padding: "10px 18px", fontSize: 13, opacity: !wallet ? 0.5 : 1 }}>
            {update.isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="paper-btn-ghost" style={{ padding: "10px 18px", fontSize: 13 }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 14, color: currentWallet ? "var(--ink)" : "var(--ink-mute)", wordBreak: "break-all" }}>{currentWallet ?? "Not set"}</span>
          <button className="btn-add" onClick={() => setEditing(true)} style={{ flexShrink: 0 }}>Edit</button>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD-LOCAL CSS ────────────────────────────────────────────────────────
// Shared CSS used by both DashboardContent and PublicProfileView.
function DashboardCSS() {
  return (
    <style>{`
      /* ── HEADER ── */
      .dash-header { display: grid; grid-template-columns: 96px 1fr auto; gap: 24px; align-items: start; padding: 40px 0 24px; }
      @media (max-width: 720px) { .dash-header { grid-template-columns: 64px 1fr; gap: 16px; } .dash-xp-block { grid-column: 1 / -1; text-align: left; padding-top: 12px; border-top: 1px solid var(--line); } }
      .big-avatar { width: 96px; height: 96px; border-radius: 50%; background: var(--paper); border: 2px solid var(--ink); display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: var(--green); position: relative; overflow: visible; }
      .big-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
      .big-avatar.evangelist::after { content: "⚡"; position: absolute; bottom: -4px; right: -4px; width: 28px; height: 28px; background: #d6a017; border-radius: 50%; border: 2px solid var(--paper); display: grid; place-items: center; font-size: 14px; color: var(--ink); z-index: 2; }
      .dash-handle { font-family: 'Inter', sans-serif; font-size: clamp(36px, 5vw, 56px); font-weight: 700; letter-spacing: -0.02em; color: var(--ink); line-height: 1; margin: 0 0 14px; word-break: break-word; }
      .dash-meta-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink-soft); }
      .level-tag { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink-soft); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
      .meta-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; border: 1px solid var(--green); color: var(--green); padding: 4px 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; }
      .meta-badge.evangelist { border-color: #d6a017; color: #d6a017; background: rgba(214,160,23,0.06); }
      .dash-xp-block { text-align: right; }
      .dash-xp-num { font-family: 'JetBrains Mono', monospace; font-size: clamp(56px, 8vw, 96px); font-weight: 700; color: var(--green); line-height: 0.9; letter-spacing: -0.02em; }
      .dash-xp-lbl { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-mute); letter-spacing: 0.15em; text-transform: uppercase; margin-top: 6px; }
      .dash-rank { font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--ink-soft); margin-top: 8px; }

      /* ── CATCH-UP ── */
      .catch-up { background: var(--paper); border: 1px solid var(--line); padding: 12px 18px; margin: 24px 0 16px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink-soft); }
      .catch-up + .catch-up { margin-top: 0; }

      /* ── REFERRAL ── */
      .ref-section { margin-bottom: 24px; }
      .ref-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-mute); letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; margin-bottom: 10px; }
      .ref-box { display: flex; align-items: center; gap: 12px; background: var(--paper); border: 1px solid var(--line); padding: 14px 18px; }
      .ref-box .url { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--green); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .ref-copy { background: transparent; border: 1px solid var(--line); color: var(--ink); padding: 6px 14px; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; flex-shrink: 0; }
      .ref-copy:hover { border-color: var(--ink); }
      .ref-help { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-mute); margin-top: 8px; }

      /* ── TABS ── */
      .tab-bar { display: grid; grid-template-columns: repeat(9, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 36px; }
      @media (max-width: 1100px) { .tab-bar { grid-template-columns: repeat(5, 1fr); border-bottom: none; } .tab-bar > .tab:nth-child(n+6) { border-top: 1px solid var(--line); } }
      @media (max-width: 720px) { .tab-bar { grid-template-columns: repeat(3, 1fr); } .tab-bar > .tab:nth-child(n+4) { border-top: 1px solid var(--line); } }
      @media (max-width: 480px) {
        .tab-bar { grid-template-columns: repeat(2, 1fr); margin-bottom: 24px; }
        .tab-bar > .tab:nth-child(n+3) { border-top: 1px solid var(--line); }
        .tab { padding: 14px 6px; font-size: 11px; letter-spacing: 0.06em; }
      }
      .tab { border: none; background: transparent; padding: 18px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-mute); cursor: pointer; border-right: 1px solid var(--line); text-align: center; line-height: 1.3; min-height: 48px; }
      .tab:last-child { border-right: none; }
      .tab:hover { color: var(--ink); }
      .tab.active { color: var(--green); background: rgba(0,200,134,0.04); box-shadow: inset 0 -2px 0 var(--green); }

      /* ── XP BREAKDOWN GRID ── */
      .xp-grid-2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      @media (max-width: 900px) { .xp-grid-2 { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 540px) { .xp-grid-2 { grid-template-columns: 1fr; } }
      .xp-card { background: var(--paper); border: 1px solid var(--line); padding: 22px 24px; }
      .xp-card .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 12px; }
      .xp-card .lbl-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .xp-card .icon { font-size: 16px; }
      .xp-card .label { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: var(--ink); letter-spacing: 0.08em; text-transform: uppercase; }
      .xp-card .val { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
      .xp-card .val small { font-size: 14px; color: var(--ink-mute); font-weight: 500; }
      .xp-card .bar { height: 3px; background: var(--paper-2); margin-top: 16px; overflow: hidden; }
      .xp-card .bar > div { height: 100%; transition: width .5s; }

      /* ── BADGES ── */
      .badges-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      @media (max-width: 900px) { .badges-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 540px) { .badges-grid { grid-template-columns: repeat(2, 1fr); } }
      .badge-tile { background: var(--paper); border: 1px solid var(--line); padding: 24px; text-align: center; cursor: pointer; transition: border-color .15s; }
      .badge-tile:hover { border-color: var(--ink); }
      .badge-tile.locked { opacity: 0.4; }
      .badge-tile img { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 14px; }
      .badge-tile .nm { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; color: var(--ink); }
      .badge-tile .tier-l { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase; }

      /* ── PANEL ── */
      .panel-section { border: 1px solid var(--line); background: var(--paper); padding: 28px; }
      @media (max-width: 540px) { .panel-section { padding: 18px; } }
      .panel-section-h { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-mute); letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; margin-bottom: 20px; }

      /* ── ACTIVITY TRACKING ── */
      .track-row { display: flex; align-items: flex-start; gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--line); }
      .track-row:last-child { border-bottom: none; }
      .track-row .iconbox { width: 44px; height: 44px; background: rgba(0,200,134,0.08); border: 1px solid rgba(0,200,134,0.3); display: grid; place-items: center; flex-shrink: 0; font-size: 18px; color: var(--green); }
      .track-row .iconbox.x { background: var(--paper-2); border-color: var(--line); color: var(--ink); }
      .track-row .info-title { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }

      /* ── SUBMISSIONS ── */
      .submission-row { background: var(--paper); border: 1px solid var(--line); padding: 16px 20px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      @media (max-width: 540px) {
        .submission-row { flex-direction: column; align-items: stretch; padding: 14px 16px; }
      }
      .submission-row .info { flex: 1; min-width: 0; }
      .submission-row .ttl { font-size: 15px; font-weight: 500; color: var(--ink); margin-bottom: 6px; }
      .submission-row .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-mute); letter-spacing: 0.08em; text-transform: uppercase; display: flex; gap: 10px; flex-wrap: wrap; }

      /* ── TWEET CARD ── */
      .tweet-card { background: var(--paper); border: 1px solid var(--line); padding: 16px 18px; }

      /* ── BUTTONS ── */
      .btn-add { background: rgba(0,200,134,0.08); border: 1px solid rgba(0,200,134,0.4); color: var(--green); padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
      .btn-add:hover { background: rgba(0,200,134,0.14); }

      /* ── FORM INPUTS ── */
      .paper-form-card { background: var(--paper); border: 1px solid var(--line); padding: 22px; }
      .paper-input { width: 100%; padding: 12px 14px; background: var(--paper); border: 1px solid var(--line); color: var(--ink); font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.5; outline: none; box-sizing: border-box; resize: vertical; }
      .paper-input:focus { border-color: var(--ink); }
      select.paper-input { font-family: 'JetBrains Mono', monospace; font-size: 13px; cursor: pointer; }
      textarea.paper-input { font-family: 'Inter', sans-serif; }

      /* ── CALLOUTS ── */
      .callout { background: var(--paper-2); border-left: 3px solid var(--green); padding: 18px 22px; border-radius: 0 6px 6px 0; }
      .callout.warn { border-left-color: #d6a017; background: rgba(214,160,23,0.06); font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-soft); line-height: 1.6; }
      .callout.tip { background: rgba(0,200,134,0.05); border: 1px solid rgba(0,200,134,0.25); border-left: 1px solid rgba(0,200,134,0.25); border-radius: 0; padding: 14px 20px; display: flex; gap: 12px; }

      /* ── OVERVIEW GRID ── */
      .overview-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
      @media (max-width: 980px) { .overview-row { grid-template-columns: 1fr; } }

      .snap-num { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; }
      .snap-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 6px; }
    `}</style>
  );
}

// ── FULL DASHBOARD CONTENT ────────────────────────────────────────────────────
export function DashboardContent({ app }: { app: Record<string, unknown> }) {
  const [activeTab, setActiveTab] = useState<"overview" | "xp" | "badges" | "activity" | "builder" | "ai" | "perks" | "journal" | "plan">("overview");
  const applicationId = app.id as number;
  const handle = (app.twitterHandle ?? app.displayHandle ?? "") as string;
  const tgHandle = (app.telegramHandle ?? "") as string;
  const level = (app.level ?? 0) as number;
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const totalScore = calcTotalXP(app as Record<string, unknown>);
  const tracks = getTracks(app.tracks);
  const { data: badgeData } = trpc.badges.getActive.useQuery({ applicationId }, { staleTime: 60000 });
  const earnedBadges = badgeData ?? [];
  const isEvangelist = !!(app.isEvangelist);
  const pfp = pfpUrl(handle, app.avatarUrl as string | null);
  const [pfpError, setPfpError] = useState(false);
  const cleanHandle = handle.replace(/^@/, "");
  const initials = cleanHandle.slice(0, 2).toUpperCase();
  const currentTier = ((app.currentTier as string | undefined) ?? "initiate");

  const { data: rankCtx } = trpc.dashboard.rankContext.useQuery({ applicationId }, { staleTime: 60000 });
  const { data: referral } = trpc.dashboard.referralCode.useQuery({ applicationId }, { staleTime: 600000 });
  const { data: tweets } = trpc.dashboard.recentTweets.useQuery({ applicationId, limit: 8 }, { staleTime: 60000 });
  const { data: xpBreakdown } = trpc.dashboard.xpLedgerBreakdown.useQuery({ applicationId }, { staleTime: 60000 });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "xp",       label: "XP Breakdown" },
    { id: "badges",   label: "Badges" },
    { id: "activity", label: "Activity" },
    { id: "builder",  label: "Builder" },
    { id: "ai",       label: "AI Studio" },
    { id: "perks",    label: "Perks" },
    { id: "journal",  label: "Journal" },
    { id: "plan",     label: "Plans" },
  ] as const;

  const ranks = rankCtx as Record<string, unknown> | undefined;
  const handleAbove = ranks?.handleAbove ? String(ranks.handleAbove).replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "").replace(/^@+/, "") : "";
  const handleBelow = ranks?.handleBelow ? String(ranks.handleBelow).replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "").replace(/^@+/, "") : "";

  const slug = (referral as { handle?: string; code?: string } | undefined)?.handle
    ?? referral?.code?.toLowerCase().replace(process.env.VITE_REFERRAL_PREFIX ?? "amb-", "")
    ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refLink = slug ? `${origin}/ref/${slug}` : "";

  return (
    <>
      <SiteHeader />
      <DashboardCSS />

      <div className="paper-container">
        {/* HEADER */}
        <header className="dash-header">
          <div className={`big-avatar${isEvangelist ? " evangelist" : ""}`}>
            {pfp && !pfpError ? (
              <img src={pfp} alt={handle} onError={() => setPfpError(true)} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <h1 className="dash-handle">@{cleanHandle || "ambassador"}</h1>
            <div className="dash-meta-row">
              <span className="level-tag">L{level} // {LEVEL_NAMES[Math.min(level, 5)]}</span>
              {isEvangelist && <span className="meta-badge evangelist">⚡ Evangelist</span>}
              {tracks.map((t) => (
                <span key={t} className="meta-badge">{TRACK_LABELS[t] ?? t.toUpperCase()}</span>
              ))}
            </div>
            {tgHandle && (
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 10, letterSpacing: "0.04em" }}>
                TG: @{tgHandle.replace(/^@/, "")}
              </div>
            )}
          </div>
          <div className="dash-xp-block">
            <div className="dash-xp-num">{totalScore.toFixed(1)}</div>
            <div className="dash-xp-lbl">Total XP</div>
            {ranks && typeof ranks.position === "number" && typeof ranks.total === "number" && (
              <div className="dash-rank">#{ranks.position as number} of {ranks.total as number}</div>
            )}
          </div>
        </header>

        {/* Catch-up / rank gap lines */}
        {Boolean(ranks?.handleAbove) && (
          <div className="catch-up">↑ @{handleAbove} | {Number(ranks?.xpGapAbove ?? 0).toFixed(1)} XP ahead</div>
        )}
        {Boolean(ranks?.handleBelow) && (
          <div className="catch-up">↓ @{handleBelow} | {Number(ranks?.xpGapBelow ?? 0).toFixed(1)} XP behind</div>
        )}

        {/* Referral link (Build Bible Part 4.3) */}
        {referral?.code && refLink && (
          <div className="ref-section">
            <div className="ref-label">Your referral link</div>
            <div className="ref-box">
              <span className="url">{refLink}</span>
              <button
                className="ref-copy"
                onClick={(e) => {
                  navigator.clipboard?.writeText(refLink);
                  const btn = e.currentTarget;
                  const original = btn.textContent;
                  btn.textContent = "Copied ✓";
                  setTimeout(() => { btn.textContent = original; }, 1600);
                }}
              >Copy</button>
            </div>
            <div className="ref-help">Anyone who joins through your link gets credited to you.</div>
          </div>
        )}

        {/* TAB BAR */}
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─────────── OVERVIEW ─────────── */}
        {activeTab === "overview" && (
          <div style={{ marginBottom: 80 }}>
            <div className="overview-row">
              <div className="panel-section">
                <div className="panel-section-h">XP Radar · 11 components</div>
                <div style={{ textAlign: "center" }}>
                  <PaperRadar app={app} />
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-section-h">Snapshot</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div className="snap-num" style={{ color: "var(--ink)", fontSize: 32 }}>{Number(app.lifetimeXp ?? totalScore).toLocaleString()}</div>
                    <div className="snap-lbl">Lifetime XP</div>
                  </div>
                  <div>
                    <div className="snap-num" style={{ color: "var(--green)", fontSize: 32 }}>{Number(app.xp30day ?? 0).toLocaleString()}</div>
                    <div className="snap-lbl">30-day XP</div>
                  </div>
                  <div>
                    <div className="snap-num" style={{ color: "#d6a017" }}>{String(currentTier).toUpperCase()}</div>
                    <div className="snap-lbl">Current tier</div>
                  </div>
                  <div>
                    <div className="snap-num" style={{ color: "var(--green)" }}>{level >= 2 ? "↑ Rising" : "→ Stable"}</div>
                    <div className="snap-lbl">Trend</div>
                  </div>
                </div>
                {ranks && typeof ranks.position === "number" && typeof ranks.total === "number" && (
                  <div className="mono" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                    You're #{ranks.position as number} of {ranks.total as number} active ambassadors.{level >= 2 ? " Climbing steadily." : ""}{" "}
                    One more rising week earns the <strong style={{ color: "var(--ink)" }}>Rising</strong> badge.
                  </div>
                )}
              </div>
            </div>

            {/* Next-level requirements panel */}
            <div className="panel-section" style={{ marginTop: 20 }}>
              <div className="panel-section-h">Next level · L{Math.min(level + 1, 5)} // {LEVEL_NAMES[Math.min(level + 1, 5)]}</div>
              {(NEXT_LEVEL_REQUIREMENTS[level] ?? []).map((req, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0, fontWeight: 700 }}>→</span>
                  <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{req}</span>
                </div>
              ))}
            </div>

            {/* Earned badges preview */}
            {earnedBadges.length > 0 && (
              <div className="panel-section" style={{ marginTop: 20 }}>
                <div className="panel-section-h">Earned badges</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {earnedBadges.map((b) => {
                    const meta = BADGE_META[b];
                    if (!meta) return null;
                    return (
                      <div key={b} title={meta.desc} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", padding: "8px 14px" }}>
                        <img src={meta.icon} alt={meta.label} style={{ width: 32, height: 32, objectFit: "contain" }} />
                        <div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--ink)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{meta.label}</div>
                          <div className="mono" style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{meta.tier} tier</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent posts strip */}
            {tweets && (tweets as unknown[]).length > 0 && (
              <div className="panel-section" style={{ marginTop: 20 }}>
                <div className="panel-section-h">Recent posts</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
                  {(tweets as Record<string, unknown>[]).slice(0, 6).map((t, i) => <TweetCard key={i} tweet={t} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────── XP BREAKDOWN ─────────── */}
        {activeTab === "xp" && (
          <div style={{ marginBottom: 80 }}>
            {(!xpBreakdown || xpBreakdown.length === 0) ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>No XP earned yet</div>
                <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>Activity is tracked daily. Post on X tagging the official handle or participate in the Telegram group.</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--paper-2)", border: "1px solid var(--ink-rule)", display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Total Lifetime XP</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{Number(app.lifetime_xp ?? 0).toLocaleString()}</div>
                </div>
                <div className="xp-grid-2">
                  {(xpBreakdown as { eventType: string; source: string; totalXp: number; count: number }[]).map((row) => {
                    const LABELS: Record<string, { label: string; icon: string; color: string }> = {
                      received_engagement: { label: "Engagement Received", icon: "⚡", color: "#00C886" },
                      post:                { label: "X Posts",             icon: "📝", color: "#00C886" },
                      tg_message:          { label: "Telegram Activity",   icon: "💬", color: "#3FA0C8" },
                      showcase_reply:      { label: "Showcase Replies",    icon: "🔁", color: "#4D80D0" },
                      reply:               { label: "X Replies",           icon: "↩️", color: "#4D80D0" },
                      manual:              { label: "Manual Award",        icon: "🎖",  color: "#D89B3E" },
                      migration_opening_balance: { label: "Opening Balance", icon: "📋", color: "#888" },
                    };
                    const meta = LABELS[row.eventType] ?? { label: row.eventType.replace(/_/g, " "), icon: "✦", color: "#888" };
                    const maxXp = Math.max(...(xpBreakdown as { totalXp: number }[]).map((r) => r.totalXp));
                    const pct = maxXp > 0 ? Math.round((row.totalXp / maxXp) * 100) : 0;
                    return (
                      <div key={row.eventType + row.source} className="xp-card">
                        <div className="head">
                          <div className="lbl-wrap">
                            <span className="icon">{meta.icon}</span>
                            <span className="label">{meta.label}</span>
                          </div>
                          <div className="val" style={{ color: meta.color }}>{row.totalXp.toLocaleString()} <small style={{ color: "var(--ink-mute)", fontWeight: 400 }}>XP</small></div>
                        </div>
                        <div className="bar"><div style={{ width: `${pct}%`, background: meta.color }} /></div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>{row.count} event{Number(row.count) !== 1 ? "s" : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─────────── BADGES ─────────── */}
        {activeTab === "badges" && (
          <div style={{ marginBottom: 80 }}>
            <div className="badges-grid">
              {Object.entries(BADGE_META).map(([key, meta]) => {
                const earned = earnedBadges.includes(key);
                return (
                  <div key={key} className={`badge-tile${earned ? "" : " locked"}`} title={meta.desc}>
                    <img src={meta.icon} alt={meta.label} />
                    <div className="nm">{meta.label}</div>
                    <div className="tier-l">{meta.tier} tier</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────── ACTIVITY ─────────── */}
        {activeTab === "activity" && (
          <div style={{ marginBottom: 80, display: "flex", flexDirection: "column", gap: 20 }}>
            <TelegramXMappingPanel applicationId={applicationId} />

            <div className="panel-section">
              <div className="panel-section-h">Recent X activity (counted toward XP)</div>
              <div className="callout" style={{ marginBottom: 18, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="mono" style={{ color: "var(--green)", fontSize: 12, fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>!</span>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                    How to get your posts tracked
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                    Tag the official handle in every protocol-related post on X. For untagged posts, some get picked up immediately without any tags or mentions, others don't — this is an X API limitation and it is outside our control. Replies to the official account do not need any tags or mentions to be tracked.
                  </div>
                </div>
              </div>
              {(!tweets || (tweets as unknown[]).length === 0) ? (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                    No scraped tweets yet
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>Activity is tracked weekly.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(tweets as Record<string, unknown>[]).map((t, i) => <TweetCard key={i} tweet={t} />)}
                </div>
              )}
            </div>

            <WalletPanel applicationId={applicationId} currentWallet={app.walletAddress as string | null} />
          </div>
        )}

        {/* ─────────── BUILDER ─────────── */}
        {activeTab === "builder" && (
          <div style={{ marginBottom: 80 }}>
            <BuilderPanel applicationId={applicationId} />
          </div>
        )}

        {/* ─────────── AI STUDIO ─────────── (full width) */}
        {activeTab === "ai" && (
          <div style={{ marginBottom: 80 }}>
            <AIStudioTab tier={currentTier} />
          </div>
        )}

        {/* ─────────── PERKS ─────────── */}
        {activeTab === "perks" && (
          <div style={{ marginBottom: 80 }}>
            <PerksTab tier={currentTier} level={level} isAdmin={isAdmin} />
          </div>
        )}

        {/* ─────────── JOURNAL ─────────── */}
        {activeTab === "journal" && (
          <div style={{ marginBottom: 80 }}>
            <div className="panel-section">
              <JournalSection applicationId={applicationId} mode="journal" />
            </div>
          </div>
        )}

        {/* ─────────── PLANS ─────────── */}
        {activeTab === "plan" && (
          <div style={{ marginBottom: 80, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="panel-section">
              <div className="panel-section-h">Your next level · L{Math.min(level + 1, 5)} // {LEVEL_NAMES[Math.min(level + 1, 5)]}</div>
              {(NEXT_LEVEL_REQUIREMENTS[level] ?? []).map((req, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0, fontWeight: 700 }}>→</span>
                  <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{req}</span>
                </div>
              ))}
            </div>
            <div className="panel-section">
              <JournalSection applicationId={applicationId} mode="plan" />
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </>
  );
}

// ── HANDLE SEARCH LANDING ─────────────────────────────────────────────────────
function HandleSearch() {
  const [, navigate] = useLocation();
  const routeParams = useParams<{ handle?: string }>();
  // Support /dashboard/:handle path param AND ?handle= query string
  const pathHandle = routeParams.handle?.replace(/^@/, "") ?? "";
  const queryHandle = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("handle")?.replace(/^@/, "") ?? ""
    : "";
  const urlHandle = pathHandle || queryHandle;
  const [input, setInput] = useState(urlHandle);
  const [searched, setSearched] = useState(urlHandle); // auto-search if handle in URL
  const { data, isLoading } = trpc.dashboard.byHandle.useQuery(
    { handle: searched },
    { enabled: !!searched, retry: false }
  );
  const handleSearch = () => {
    const clean = input.trim().replace(/^@/, "");
    if (clean) setSearched(clean);
  };
  if (searched && isLoading) return (
    <>
      <SiteHeader />
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Loading…</div>
      </div>
      <SiteFooter />
    </>
  );
  if (searched && data) return <DashboardContent app={data as Record<string, unknown>} />;
  return (
    <>
      <SiteHeader />
      <section className="paper-noise" style={{ padding: "72px 0 56px", position: "relative" }}>
        <div className="paper-container" style={{ maxWidth: 720 }}>
          <div className="paper-pill" style={{ marginBottom: 24 }}>
            <span className="paper-dot" /> Ambassador Dashboard
          </div>
          <h1 className="h-display serif" style={{ marginBottom: 18 }}>
            Your stats. <em>Your rank.</em> Your proof.
          </h1>
          <p className="lead">
            Enter a Twitter handle to view that ambassador's XP breakdown, rank context, activity feed, and badges.
          </p>
          <div style={{ display: "flex", marginTop: 12, alignItems: "stretch", maxWidth: 520 }}>
            <div className="mono" style={{ display: "flex", alignItems: "center", padding: "0 14px", background: "var(--paper)", border: "1px solid var(--line)", borderRight: "none", fontSize: 16, color: "var(--ink-mute)" }}>@</div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="yourhandle"
              style={{
                flex: 1, background: "var(--paper)", border: "1px solid var(--line)", borderRight: "none",
                color: "var(--ink)", padding: "14px 14px", fontFamily: "'Inter', sans-serif",
                fontSize: 16, outline: "none", minWidth: 0,
              }}
            />
            <button onClick={handleSearch} className="paper-btn-primary" style={{ borderRadius: 0, padding: "0 28px", fontSize: 14 }}>
              Go →
            </button>
          </div>
          {searched && !isLoading && !data && (
            <div className="mono" style={{ marginTop: 20, fontSize: 12, color: "#c14b3a", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Handle not found. Make sure the ambassador has applied to the program.
            </div>
          )}
          <div style={{ marginTop: 32, fontSize: 15, color: "var(--ink-soft)" }}>
            Not in the program yet?{" "}
            <button
              onClick={() => navigate("/apply")}
              className="ulink"
              style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 15, padding: 0 }}
            >
              Apply now →
            </button>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

// ── TELEGRAM CLAIM FLOW ─────────────────────────────────────────────────────
// Multi-step flow for TG users who logged in but have no matched application.
function TelegramClaimFlow({ onNavigate, onClaimed }: { onNavigate: (path: string) => void; onClaimed: () => void }) {
  type Step = "ask" | "enter_x" | "pick_list" | "success";
  const [step, setStep] = useState<Step>("ask");
  const [xHandle, setXHandle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const claimByXHandle = trpc.ambassador.claimByXHandle.useMutation();
  const claimById = trpc.ambassador.claimById.useMutation();
  const { data: unclaimedList, isLoading: listLoading } = trpc.ambassador.listUnclaimed.useQuery(
    undefined,
    { enabled: step === "pick_list" }
  );

  async function handleXSubmit() {
    const clean = xHandle.trim().replace(/^@/, "");
    if (!clean) { setError("Please enter your X handle."); return; }
    setBusy(true); setError("");
    try {
      const res = await claimByXHandle.mutateAsync({ xHandle: clean });
      if (res.success) {
        setStep("success");
        setTimeout(onClaimed, 1200);
      } else {
        setError("");
        setStep("pick_list");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickSubmit() {
    if (!selectedId) { setError("Please select your application from the list."); return; }
    setBusy(true); setError("");
    try {
      const res = await claimById.mutateAsync({ applicationId: selectedId });
      if (res.success) {
        setStep("success");
        setTimeout(onClaimed, 1200);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const wrap: React.CSSProperties = { minHeight: "60vh", display: "grid", placeItems: "center", padding: "48px 0" };

  if (step === "success") return (
    <>
      <SiteHeader />
      <div style={wrap}>
        <div className="paper-container" style={{ maxWidth: 520, textAlign: "center" }}>
          <div className="eyebrow">· Your Protocol</div>
          <h1 className="h-section serif" style={{ color: "var(--green)" }}>Application linked.</h1>
          <p className="lead" style={{ margin: "0 auto" }}>
            Your Telegram account is now connected to your application. Loading your dashboard…
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );

  if (step === "ask") return (
    <>
      <SiteHeader />
      <div style={wrap}>
        <div className="paper-container" style={{ maxWidth: 520, textAlign: "center" }}>
          <div className="eyebrow">· Your Protocol</div>
          <h1 className="h-section serif">Welcome.</h1>
          <p className="lead" style={{ margin: "0 auto 32px" }}>
            We couldn't automatically find an application linked to your Telegram account. Have you already applied to the Ambassador Program?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button className="paper-btn-primary" onClick={() => setStep("enter_x")}>Yes, I applied</button>
            <button className="paper-btn-ghost" onClick={() => onNavigate("/apply")}>No, take me to apply</button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );

  if (step === "enter_x") return (
    <>
      <SiteHeader />
      <div style={wrap}>
        <div className="paper-container" style={{ maxWidth: 520, textAlign: "center" }}>
          <div className="eyebrow">· Your Protocol</div>
          <h1 className="h-section serif">Find your application</h1>
          <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 auto 8px" }}>
            Enter the <strong>X (Twitter) handle</strong> you submitted on your application.
          </p>
          <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24 }}>
            Format: <span style={{ color: "var(--green)" }}>yourhandle</span>  (no @ needed)
          </div>
          <input
            className="paper-input"
            placeholder="yourhandle"
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleXSubmit()}
            disabled={busy}
            autoFocus
            style={{ marginBottom: 16, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
          />
          {error && (
            <div className="mono" style={{ fontSize: 12, color: "#c14b3a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button className="paper-btn-primary" style={{ opacity: busy ? 0.5 : 1 }} onClick={handleXSubmit} disabled={busy}>
              {busy ? "Searching…" : "Find my application"}
            </button>
            <button className="paper-btn-ghost" onClick={() => setStep("ask")}>← Back</button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );

  if (step === "pick_list") return (
    <>
      <SiteHeader />
      <div style={wrap}>
        <div className="paper-container" style={{ maxWidth: 640, textAlign: "center" }}>
          <div className="eyebrow">· Your Protocol</div>
          <h1 className="h-section serif">Pick your application</h1>
          <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 auto 8px" }}>
            We couldn't find a match for that handle. Select your application from the list below.
          </p>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 24, letterSpacing: "0.06em" }}>
            If you don't see yours, contact the team.
          </div>
          {listLoading ? (
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 24 }}>
              Loading list…
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 20, border: "1px solid var(--line)", textAlign: "left", background: "var(--paper)" }}>
              {(unclaimedList ?? []).map((a: Record<string, unknown>) => {
                const display = String((a.displayHandle ?? a.twitterHandle ?? a.telegramHandle ?? `#${a.id}`) as string);
                const tracksList = Array.isArray(a.tracks) ? (a.tracks as string[]).join(" · ").toUpperCase() : "";
                const isSelected = selectedId === (a.id as number);
                return (
                  <div
                    key={a.id as number}
                    onClick={() => setSelectedId(a.id as number)}
                    style={{
                      padding: "14px 18px",
                      cursor: "pointer",
                      background: isSelected ? "rgba(0,200,134,0.08)" : "transparent",
                      borderLeft: isSelected ? "3px solid var(--green)" : "3px solid transparent",
                      borderBottom: "1px solid var(--line)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 13, color: isSelected ? "var(--green)" : "var(--ink)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                        @{display.replace(/^@/, "")}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 3, letterSpacing: "0.08em" }}>{tracksList}</div>
                    </div>
                    {isSelected && <div className="mono" style={{ fontSize: 10, color: "var(--green)", letterSpacing: "0.1em", fontWeight: 700 }}>SELECTED ✓</div>}
                  </div>
                );
              })}
              {(unclaimedList ?? []).length === 0 && (
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", padding: 20, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  No unclaimed applications found.
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="mono" style={{ fontSize: 12, color: "#c14b3a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button
              className="paper-btn-primary"
              style={{ opacity: (busy || !selectedId) ? 0.5 : 1 }}
              onClick={handlePickSubmit}
              disabled={busy || !selectedId}
            >
              {busy ? "Linking…" : "This is my application"}
            </button>
            <button className="paper-btn-ghost" onClick={() => { setStep("enter_x"); setError(""); }}>← Try X handle again</button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );

  return null;
}

// ── TELEGRAM LOGIN SCREEN ────────────────────────────────────────────────────
function TelegramLoginScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { refresh } = useAuth();
  const [error, setError] = useState("");

  return (
    <>
      <SiteHeader />
      <section className="paper-noise" style={{ padding: "72px 0 56px", position: "relative" }}>
        <div className="paper-container" style={{ maxWidth: 640, textAlign: "center" }}>
          <div className="paper-pill" style={{ marginBottom: 24, display: "inline-flex" }}>
            <span className="paper-dot" /> Ambassador Dashboard
          </div>
          <h1 className="h-display serif">
            Sign in to view your <em>dashboard.</em>
          </h1>
          <p className="lead" style={{ margin: "0 auto 32px" }}>
            Sign in with your Telegram account to view your XP, rank, activity feed, and accountability journal.
          </p>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <TelegramLoginButton
              onSuccess={() => refresh()}
              onError={(msg) => setError(msg)}
            />
          </div>

          {error && (
            <div className="mono" style={{ fontSize: 12, color: "#c14b3a", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{error}</div>
          )}

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
            <button
              onClick={() => onNavigate("/leaderboard")}
              className="mono"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ink-soft)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}
            >
              View Public Leaderboard →
            </button>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

// ── PERSONAL DASHBOARD (logged-in user) ──────────────────────────────────────
function PersonalDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: application, isLoading: appLoading } = trpc.ambassador.myApplication.useQuery(undefined, {
    enabled: !!user,
  });

  if (authLoading || appLoading) return (
    <>
      <SiteHeader />
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Loading…</div>
      </div>
      <SiteFooter />
    </>
  );

  if (!user) return (
    <TelegramLoginScreen onNavigate={navigate} />
  );

  if (!application) {
    const isTgUser = user?.openId?.startsWith('tg:');
    if (isTgUser) {
      return <TelegramClaimFlow onNavigate={navigate} onClaimed={() => window.location.reload()} />;
    }
    return (
      <>
        <SiteHeader />
        <section className="paper-noise" style={{ padding: "72px 0 56px", position: "relative" }}>
          <div className="paper-container" style={{ maxWidth: 520, textAlign: "center" }}>
            <div className="eyebrow">· Your Protocol</div>
            <h1 className="h-section serif">No application found.</h1>
            <p className="lead" style={{ margin: "0 auto 32px" }}>
              You haven't submitted an application yet. Apply to join the Ambassador Program.
            </p>
            <button onClick={() => navigate("/apply")} className="paper-btn-primary">Apply now ↗</button>
          </div>
        </section>
        <SiteFooter />
      </>
    );
  }

  // Use the single DashboardContent component — same as handle-search view
  return <DashboardContent app={application as Record<string, unknown>} />;
}

// ── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function AmbassadorDashboard() {
  const params = useParams<{ id?: string }>();
  const { loading: authLoading } = useAuth();
  const id = params?.id ? parseInt(params.id, 10) : null;

  // /ambassador/:id — public profile view
  if (id && !isNaN(id)) {
    return <PublicProfileView id={id} />;
  }

  // While auth is loading, show spinner
  if (authLoading) return (
    <>
      <SiteHeader />
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Loading…</div>
      </div>
      <SiteFooter />
    </>
  );

  // /dashboard/:handle or ?handle= — public handle search (works for everyone including admins)
  if (params?.id === undefined && typeof window !== "undefined" &&
      (window.location.pathname.match(/^\/dashboard\/[^/]+$/) || new URLSearchParams(window.location.search).get("handle"))) {
    return <HandleSearch />;
  }

  // /dashboard — personal dashboard (works for admins too — loads by email)
  return <PersonalDashboard />;
}

