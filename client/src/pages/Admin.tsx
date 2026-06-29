import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import XTracker from "./XTracker";
import TelegramTracker from "./TelegramTracker";

type Status = "pending" | "approved" | "rejected";

type Application = {
  id: number;
  rowNum?: number;
  email: string;
  isEvangelist: number;
  tracks: unknown;
  contributionIntent: unknown;
  testScore: number;
  communities: string;
  twitterHandle: string | null;
  telegramHandle: string | null;
  githubHandle: string | null;
  otherLinks: string | null;
  hasCommunityExperience: "yes" | "no";
  communityLinks: unknown;
  protocolDescription: string;
  communityBenefit: string;
  firstThirtyDays: string;
  status: Status;
  adminNotes: string | null;
  // Ranking fields
  level: number;
  evangelistCandidate: number;
  fraudFlag?: number | null;
  claimPending?: number | null;
  xContentScore: number;
  xEngagementScore: number;
  xConsistencyScore: number;
  communityContribScore: number;
  tgActivityScore: number;
  adminOverrideScore: number;
  totalScore: number;
  scoreTrend: number;
  xpTrend: number;
  weeklyScores: unknown;
  badges: unknown;
  scoreUpdatedAt: Date | null;
  totalXP: number;
  xpUpdatedAt: Date | null;
  lastScrapedAt?: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Status, { bg: string; color: string; border: string }> = {
  pending: { bg: "#FFF9E6", color: "#B7791F", border: "#F6E05E" },
  approved: { bg: "#F0FFF4", color: "#276749", border: "#9AE6B4" },
  rejected: { bg: "#FFF5F5", color: "#C53030", border: "#FEB2B2" },
};

const LEVELS = [
  { level: 0, name: "Applicant",       color: "#aaa", bg: "#111" },
  { level: 1, name: "Contributor",     color: "#AAA", bg: "#1A1A1A" },
  { level: 2, name: "Ambassador",      color: "#00FF9D", bg: "#001A0F" },
  { level: 3, name: "Lead Ambassador", color: "#00CC7D", bg: "#001508" },
  { level: 4, name: "Ecosystem Lead",  color: "#00AA60", bg: "#001005" },
  { level: 5, name: "Full-Time",       color: "#FFD700", bg: "#1A1400" },
];

const BADGE_META: Record<string, { label: string; emoji: string; color: string }> = {
  knowledgeable:       { label: "Knowledgeable",     emoji: "🧠", color: "#7C3AED" },
  perfect_score:       { label: "Perfect Score",     emoji: "🎯", color: "#DC2626" },
  articulate:          { label: "Articulate",        emoji: "📝", color: "#2563EB" },
  consistent:          { label: "Consistent",        emoji: "🔥", color: "#EA580C" },
  community_builder:   { label: "Community Builder", emoji: "💬", color: "#0891B2" },
  amplifier:           { label: "Amplifier",         emoji: "📣", color: "#7C3AED" },
  creator:             { label: "Creator",           emoji: "✍️", color: "#059669" },
  high_reach:          { label: "High Reach",        emoji: "🚀", color: "#DC2626" },
  network_embedded:    { label: "Network Embedded",  emoji: "🌍", color: "#0891B2" },
  evangelist_candidate:{ label: "⚡ Evangelist",     emoji: "⚡", color: "#00FF9D" },
};

// ── SHARED COMPONENTS ────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "#000" : "#fff", border: "1px solid #000", padding: "20px 24px" }}>
      <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: accent ? "var(--brand-green)" : "#666", fontSize: 19.5 }}>
        {label}
      </div>
      <div className="font-display font-bold" style={{ fontSize: 42, color: accent ? "var(--brand-green)" : "#000", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", padding: "12px 16px" }}>
      <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "#666", fontSize: 19.5 }}>{label}</div>
      <div className="text-sm" style={{ color: "#000" }}>{value}</div>
    </div>
  );
}

function LongField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "#666", fontSize: 19.5 }}>{label}</div>
      <div style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "14px 16px", fontSize: 19.5, lineHeight: 1.7, color: "#333" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  const l = LEVELS[Math.min(level, 5)];
  return (
    <span className="font-mono font-bold uppercase tracking-widest"
      style={{ fontSize: 16.5, background: l.bg, color: l.color, border: `1px solid ${l.color}40`, padding: "2px 8px", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
      L{l.level} {l.name}
    </span>
  );
}

function BadgeChip({ badgeKey }: { badgeKey: string }) {
  const meta = BADGE_META[badgeKey];
  if (!meta) return null;
  return (
    <span title={meta.label}
      style={{ fontSize: 19.5, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}40`, padding: "2px 7px", borderRadius: 2, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span>{meta.emoji}</span>
      <span className="font-mono" style={{ fontSize: 16.5 }}>{meta.label}</span>
    </span>
  );
}

function TrendIndicator({ trend }: { trend: number }) {
  if (trend === 1) return <span style={{ color: "#00FF9D", fontSize: 24 }} title="Climbing">↑</span>;
  if (trend === -1) return <span style={{ color: "#e53e3e", fontSize: 24 }} title="Dropping">↓</span>;
  return <span style={{ color: "#aaa", fontSize: 24 }} title="Flat">—</span>;
}

function ScoreBar({ value, max = 10, color = "#00FF9D" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

// ── APPLICATION DRAWER ───────────────────────────────────────────────────────

function ApplicationDrawer({ app, onClose, onStatusUpdate }: {
  app: Application;
  onClose: () => void;
  onStatusUpdate: (id: number, status: Status, notes?: string) => void;
}) {
  const [notes, setNotes] = useState(app.adminNotes ?? "");
  const [updating, setUpdating] = useState(false);

  const updateMutation = trpc.ambassador.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); setUpdating(false); },
    onError: (err) => { toast.error(err.message); setUpdating(false); },
  });

  const confirmClaimMutation = trpc.ambassador.confirmClaim.useMutation({
    onSuccess: () => toast.success("Claim confirmed — AI/tier benefits unlocked"),
    onError: (err) => toast.error(err.message),
  });

  const handleUpdate = (status: Status) => {
    setUpdating(true);
    updateMutation.mutate({ id: app.id, status, adminNotes: notes }, {
      onSuccess: () => { onStatusUpdate(app.id, status, notes); },
    });
  };

  const statusStyle = STATUS_STYLES[app.status];
  const tracks = (app.tracks as string[] | null) ?? [];
  const intent = (app.contributionIntent as string[] | null) ?? [];
  const communityLinks = (app.communityLinks as { url: string; description: string }[] | null) ?? [];
  const badges = (app.badges as string[] | null) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-full overflow-y-auto" style={{ width: "100%", maxWidth: 560, background: "#fff", borderLeft: "1px solid #000" }}>
        <div style={{ background: "#000", padding: "20px 28px", position: "sticky", top: 0, zIndex: 10 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>APPLICATION #{app.rowNum ?? app.id}</div>
              <h3 className="font-display font-bold uppercase" style={{ fontSize: 27, color: "#fff" }}>
                {tracks.join(" · ").toUpperCase() || "—"}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid #333", color: "#aaa", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 24 }}>×</button>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, padding: "4px 12px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusStyle.color }} />
              <span className="font-mono font-bold uppercase tracking-widest" style={{ color: statusStyle.color, fontSize: 19.5 }}>{app.status}</span>
            </div>
            <LevelBadge level={app.level} />
            {app.evangelistCandidate === 1 && (
              <span className="font-mono font-bold uppercase" style={{ fontSize: 16.5, background: "#001A0F", color: "#00FF9D", border: "1px solid #00FF9D40", padding: "2px 8px" }}>⚡ Evangelist Candidate</span>
            )}
          </div>

          {badges.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "#666", fontSize: 19.5 }}>Badges Earned</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {badges.map((b) => <BadgeChip key={b} badgeKey={b} />)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-0.5 mb-6" style={{ background: "#000", border: "1px solid #000" }}>
            <InfoRow label="Email" value={app.email || "—"} />
            <InfoRow label="Tracks" value={tracks.join(", ") || "—"} />
            <InfoRow label="Test Score" value={`${app.testScore} / 10`} />
            <InfoRow label="Total XP" value={`${app.totalXP.toFixed(1)} XP`} />
            <InfoRow label="Community Experience" value={app.hasCommunityExperience === "yes" ? "Yes" : "No"} />
            <InfoRow label="Twitter" value={app.twitterHandle || "—"} />
            <InfoRow label="Telegram" value={app.telegramHandle || "—"} />
            <InfoRow label="GitHub" value={app.githubHandle || "—"} />
            <InfoRow label="Applied" value={new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
            <InfoRow label="Updated" value={new Date(app.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "#666", fontSize: 19.5 }}>Contribution Intent</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {intent.map((item, i) => (
                <span key={i} style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "3px 10px", fontSize: 19.5, color: "#333" }}>{item}</span>
              ))}
            </div>
          </div>

          <LongField label="Communities / Networks" value={app.communities} />
          <LongField label="Describe Protocol" value={app.protocolDescription} />
          <LongField label="How Program Benefits You / Community" value={app.communityBenefit} />
          <LongField label="First 30 Days Plan" value={app.firstThirtyDays} />
          {app.otherLinks && <LongField label="Other Links" value={app.otherLinks} />}

          {communityLinks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "#666", fontSize: 19.5 }}>Community Links</div>
              {communityLinks.map((link, i) => (
                <div key={i} style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "10px 14px", marginBottom: 6 }}>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{ color: "#00FF9D", fontSize: 19.5, display: "block", marginBottom: 2 }}>{link.url}</a>
                  <span style={{ fontSize: 19.5, color: "#444" }}>{link.description}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "#666", fontSize: 19.5 }}>Admin Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes (not visible to applicant)..."
              style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px 14px", fontSize: 22.5, fontFamily: "'Inter', sans-serif", color: "#000", resize: "vertical", outline: "none" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <button onClick={() => handleUpdate("approved")} disabled={updating || app.status === "approved"}
              style={{ background: app.status === "approved" ? "#276749" : "var(--brand-green)", border: "1px solid #000", boxShadow: "2px 2px 0 #000", padding: "10px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: app.status === "approved" ? "#fff" : "#000", cursor: updating || app.status === "approved" ? "not-allowed" : "pointer", opacity: updating ? 0.6 : 1 }}>
              {app.status === "approved" ? "✓ Ambassador" : "Grant Ambassador"}
            </button>
            <button onClick={() => handleUpdate("pending")} disabled={updating || app.status === "pending"}
              style={{ background: "#fff", border: "1px solid #000", boxShadow: "2px 2px 0 #000", padding: "10px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", cursor: updating || app.status === "pending" ? "not-allowed" : "pointer", opacity: updating || app.status === "pending" ? 0.5 : 1 }}>
              {app.status === "pending" ? "✓ Promoted" : "Promote"}
            </button>
            <button onClick={() => handleUpdate("rejected")} disabled={updating || app.status === "rejected"}
              style={{ background: app.status === "rejected" ? "#C53030" : "#fff", border: "1px solid #000", boxShadow: "2px 2px 0 #000", padding: "10px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: app.status === "rejected" ? "#fff" : "#000", cursor: updating || app.status === "rejected" ? "not-allowed" : "pointer", opacity: updating ? 0.6 : 1 }}>
              {app.status === "rejected" ? "✗ Rejected" : "Reject"}
            </button>
          </div>
          {Number(app.claimPending ?? 0) === 1 && (
            <button onClick={() => confirmClaimMutation.mutate({ id: app.id })}
              disabled={confirmClaimMutation.isPending}
              style={{ marginTop: 12, width: "100%", background: "#FFD24A", border: "1px solid #000", boxShadow: "2px 2px 0 #000", padding: "10px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", cursor: confirmClaimMutation.isPending ? "not-allowed" : "pointer", opacity: confirmClaimMutation.isPending ? 0.6 : 1 }}>
              ⚠ Confirm Pending Claim
            </button>
          )}
          <DashboardButton applicationId={app.id} twitterHandle={app.twitterHandle} />
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD BUTTON ───────────────────────────────────────────────────────────────
function DashboardButton({ applicationId }: { applicationId: number; twitterHandle?: string | null }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(`/admin/dashboard/${applicationId}`)}
      style={{
        marginTop: 10,
        width: "100%",
        background: "#0A0A0A",
        border: "1px solid #333",
        boxShadow: "2px 2px 0 #000",
        padding: "10px 0",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 19.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: "#00FF9D",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 21 }}>↗️</span>
      View Dashboard
    </button>
  );
}

// ── SCORE EDITOR PANEL ───────────────────────────────────────────────────────────────

function ScoreEditor({ app, onClose, onSaved }: {
  app: Application;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState({
    xContentScore: app.xContentScore,
    xEngagementScore: app.xEngagementScore,
    xConsistencyScore: app.xConsistencyScore,
    communityContribScore: app.communityContribScore,
    tgActivityScore: app.tgActivityScore,
    adminOverrideScore: app.adminOverrideScore,
    level: app.level,
    evangelistCandidate: app.evangelistCandidate,
    fraudFlag: app.fraudFlag ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const updateScores = trpc.ambassador.updateScores.useMutation({
    onSuccess: () => { toast.success("Scores saved"); setSaving(false); onSaved(); onClose(); },
    onError: (err) => { toast.error(err.message); setSaving(false); },
  });

  const handleSave = () => {
    setSaving(true);
    updateScores.mutate({ id: app.id, ...scores });
  };

  const tracks = (app.tracks as string[] | null) ?? [];

  const ScoreSlider = ({ field, label, min = 0, max = 10, step = 0.5, color = "#00FF9D" }: {
    field: keyof typeof scores;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
  }) => {
    const val = scores[field] as number;
    return (
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 18 }}>{label}</span>
          <span className="font-mono font-bold" style={{ color, fontSize: 24 }}>{val.toFixed(1)}</span>
        </div>
        <ScoreBar value={val - min} max={max - min} color={color} />
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={(e) => setScores(prev => ({ ...prev, [field]: parseFloat(e.target.value) }))}
          style={{ width: "100%", marginTop: 6, accentColor: color }} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-full overflow-y-auto" style={{ width: "100%", maxWidth: 480, background: "#0A0A0A", borderLeft: "1px solid #1E1E1E" }}>
        <div style={{ background: "#000", padding: "20px 28px", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #1E1E1E" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>SCORE EDITOR</div>
              <h3 className="font-display font-bold uppercase" style={{ fontSize: 24, color: "#fff" }}>
                #{app.rowNum ?? app.id} : {tracks.join(" · ").toUpperCase() || "—"}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid #333", color: "#aaa", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 24 }}>×</button>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {/* Level selector */}
          <div style={{ marginBottom: 28 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-3" style={{ color: "#aaa", fontSize: 18 }}>Program Level</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {LEVELS.map((l) => (
                <button key={l.level} onClick={() => setScores(prev => ({ ...prev, level: l.level }))}
                  style={{ background: scores.level === l.level ? l.bg : "#111", border: `1px solid ${scores.level === l.level ? l.color : "#333"}`, color: scores.level === l.level ? l.color : "#aaa", padding: "8px 4px", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}>
                  L{l.level} {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Evangelist candidate toggle */}
          <div style={{ marginBottom: 28, background: "#111", border: "1px solid #222", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="font-mono font-bold uppercase tracking-widest" style={{ color: "#00FF9D", fontSize: 18 }}>⚡ Evangelist Candidate</div>
              <div style={{ color: "#aaa", fontSize: 18, marginTop: 3 }}>Flag for Token2049 shortlist</div>
            </div>
            <button onClick={() => setScores(prev => ({ ...prev, evangelistCandidate: prev.evangelistCandidate === 1 ? 0 : 1 }))}
              style={{ background: scores.evangelistCandidate === 1 ? "#00FF9D" : "#222", border: `1px solid ${scores.evangelistCandidate === 1 ? "#00FF9D" : "#444"}`, color: scores.evangelistCandidate === 1 ? "#000" : "#aaa", padding: "6px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}>
              {scores.evangelistCandidate === 1 ? "✓ YES" : "NO"}
            </button>
          </div>

          {/* Fraud flag toggle — locks tier to Starter, zeroes earn, excludes Solitaire */}
          <div style={{ marginBottom: 28, background: "#111", border: "1px solid #222", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="font-mono font-bold uppercase tracking-widest" style={{ color: "#FF5555", fontSize: 18 }}>⚠ Fraud Flag</div>
              <div style={{ color: "#aaa", fontSize: 18, marginTop: 3 }}>Locks tier to Starter, zeroes daily earn, excludes Solitaire</div>
            </div>
            <button onClick={() => setScores(prev => ({ ...prev, fraudFlag: prev.fraudFlag === 1 ? 0 : 1 }))}
              style={{ background: scores.fraudFlag === 1 ? "#FF5555" : "#222", border: `1px solid ${scores.fraudFlag === 1 ? "#FF5555" : "#444"}`, color: scores.fraudFlag === 1 ? "#000" : "#aaa", padding: "6px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}>
              {scores.fraudFlag === 1 ? "✓ FLAGGED" : "CLEAR"}
            </button>
          </div>

          {/* Score sliders */}
          <div style={{ marginBottom: 8 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-4" style={{ color: "#aaa", fontSize: 18 }}>X / Twitter Signals</div>
            <ScoreSlider field="xContentScore" label="Content Quality" color="#00FF9D" />
            <ScoreSlider field="xEngagementScore" label="Engagement (Reach)" color="#00CC7D" />
            <ScoreSlider field="xConsistencyScore" label="Consistency (Week-over-week)" color="#00AA60" />
          </div>

          <div style={{ marginBottom: 8, borderTop: "1px solid #1E1E1E", paddingTop: 20 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-4" style={{ color: "#aaa", fontSize: 18 }}>Community Signals</div>
            <ScoreSlider field="communityContribScore" label="Community Contribution (Replies, Likes, Amplification)" color="#7C3AED" />
            <ScoreSlider field="tgActivityScore" label="Telegram Activity" color="#0891B2" max={20} />
          </div>

          <div style={{ borderTop: "1px solid #1E1E1E", paddingTop: 20, marginBottom: 28 }}>
            <div className="font-mono font-bold uppercase tracking-widest mb-4" style={{ color: "#aaa", fontSize: 18 }}>Admin Override</div>
            <ScoreSlider field="adminOverrideScore" label="Manual Bonus / Penalty" min={-10} max={10} step={0.5} color="#FFD700" />
            <div style={{ fontSize: 18, color: "#aaa", marginTop: -8 }}>Use to reward exceptional behaviour or flag concerns. Range: −10 to +10.</div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: "100%", background: saving ? "#111" : "var(--brand-green)", border: "1px solid var(--brand-green)", boxShadow: "2px 2px 0 #00FF9D40", padding: "14px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 21, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: saving ? "#aaa" : "#000", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Scores →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RANKINGS TAB ─────────────────────────────────────────────────────────────

function RankingsTab() {
  const [evangelistMode, setEvangelistMode] = useState(false);
  const [scoreEditorApp, setScoreEditorApp] = useState<Application | null>(null);
  const utils = trpc.useUtils();

  const { data: leaderboard, isLoading, refetch } = trpc.ambassador.leaderboard.useQuery(
    { evangelistMode }
  );

  const rows = (leaderboard ?? []) as (Application & { evangelistScore?: number })[];

  const handleSaved = () => {
    refetch();
    utils.ambassador.leaderboard.invalidate();
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ background: "#fff", border: "1px solid #000", padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>
            {evangelistMode ? "⚡ EVANGELIST MODE: TOKEN2049 SHORTLIST" : "AMBASSADOR RANKING: FULL PROGRAM"}
          </div>
          <div style={{ fontSize: 18, color: "#555" }}>
            {evangelistMode
              ? "Ranked by Total XP. Top 12 highlighted as Token2049 shortlist candidates."
              : "Ranked by Total XP (automated XP engine). Same scores shown on public leaderboard."}
          </div>
          {rows.length > 0 && rows[0].xpUpdatedAt && (
            <div style={{ fontSize: 15, color: "#555", marginTop: 4 }}>
              Last XP recalculated: {new Date(rows[0].xpUpdatedAt).toLocaleString()}
            </div>
          )}
        </div>
        <button onClick={() => setEvangelistMode(v => !v)}
          style={{ background: evangelistMode ? "#00FF9D" : "#fff", border: `1px solid ${evangelistMode ? "#00FF9D" : "#000"}`, color: evangelistMode ? "#000" : "#aaa", padding: "8px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}>
          {evangelistMode ? "⚡ Evangelist Mode ON" : "Switch to Evangelist Mode"}
        </button>
      </div>

      {/* Table header */}
      <div style={{ background: "#000", border: "1px solid #000", borderBottom: "none" }}>
        <div className="hidden md:grid items-center" style={{ gridTemplateColumns: "48px 40px 1fr 140px 90px 120px 80px 90px", padding: "10px 16px", gap: 12 }}>
          {["Rank", "", "Applicant", "Level", "Score", "Badges", "Trend", "Actions"].map((h) => (
            <div key={h} className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 16.5 }}>{h}</div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ border: "1px solid #000", background: "#fff" }}>
        {isLoading ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div className="font-mono uppercase tracking-widest" style={{ color: "#555", fontSize: 19.5 }}>Loading rankings...</div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div className="font-mono uppercase tracking-widest" style={{ color: "#555", fontSize: 19.5 }}>No ranked applicants yet</div>
          </div>
        ) : (
          rows.map((app, idx) => {
            const rank = idx + 1;
            // Use totalXP as the single source of truth — same as public leaderboard
            const score = evangelistMode ? (app.evangelistScore ?? app.totalXP) : app.totalXP;
            const tracks = (app.tracks as string[] | null) ?? [];
            const badges = (app.badges as string[] | null) ?? [];
            const isTop12 = evangelistMode && rank <= 12;

            return (
              <div key={app.id}
                style={{ borderBottom: idx < rows.length - 1 ? "1px solid #EEE" : "none", background: isTop12 ? "#F0FFF4" : "transparent", transition: "background 0.1s" }}
                onMouseEnter={(e) => { if (!isTop12) (e.currentTarget as HTMLDivElement).style.background = "#F9F9F9"; }}
                onMouseLeave={(e) => { if (!isTop12) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>

                {/* Desktop row */}
                <div className="hidden md:grid items-center" style={{ gridTemplateColumns: "48px 40px 1fr 140px 90px 120px 80px 90px", padding: "14px 16px", gap: 12 }}>
                  {/* Rank */}
                  <div className="font-mono font-bold" style={{ color: rank <= 3 ? "#B7791F" : rank <= 12 && evangelistMode ? "#276749" : "#aaa", fontSize: rank <= 3 ? 16 : 14 }}>
                    #{rank}
                  </div>

                  {/* Evangelist flag */}
                  <div>
                    {app.evangelistCandidate === 1 && (
                      <span title="Evangelist Candidate" style={{ color: "#00FF9D", fontSize: 24 }}>⚡</span>
                    )}
                  </div>

                  {/* Applicant info */}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono font-bold" style={{ color: "#000", fontSize: 19.5 }}>
                        {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : app.email || `#${app.id}`}
                      </span>
                      {app.isEvangelist === 1 && (
                        <span className="font-mono font-bold uppercase" style={{ fontSize: 15, background: "#F0FFF4", color: "#276749", border: "1px solid #9AE6B4", padding: "1px 5px" }}>OG</span>
                      )}
                    </div>
                    <div style={{ fontSize: 16.5, color: "#555" }}>
                      {tracks.join(" · ").toUpperCase() || "—"} · Test: {app.testScore}/10
                    </div>
                  </div>

                  {/* Level */}
                  <LevelBadge level={app.level} />

                  {/* Score */}
                  <div>
                    <div className="font-mono font-bold" style={{ color: score >= 70 ? "#276749" : score >= 40 ? "#B7791F" : "#C53030", fontSize: 27, lineHeight: 1 }}>
                      {score.toFixed(1)}
                    </div>
                    <ScoreBar value={score} max={100} color={score >= 70 ? "#276749" : score >= 40 ? "#B7791F" : "#C53030"} />
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {badges.slice(0, 3).map((b) => {
                      const meta = BADGE_META[b];
                      return meta ? (
                        <span key={b} title={meta.label} style={{ fontSize: 21 }}>{meta.emoji}</span>
                      ) : null;
                    })}
                    {badges.length > 3 && <span style={{ fontSize: 16.5, color: "#555" }}>+{badges.length - 3}</span>}
                  </div>

                  {/* Trend */}
                  <TrendIndicator trend={app.xpTrend ?? 0} />

                  {/* Actions */}
                  <button onClick={() => setScoreEditorApp(app)}
                    style={{ background: "#fff", border: "1px solid #000", color: "#000", padding: "5px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Score →
                  </button>
                </div>

                {/* Mobile row */}
                <div className="flex items-start gap-3 md:hidden" style={{ padding: "14px 16px" }}>
                  <div className="font-mono font-bold" style={{ color: rank <= 3 ? "#B7791F" : "#aaa", fontSize: 24, minWidth: 32 }}>#{rank}</div>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-bold" style={{ color: "#000", fontSize: 19.5 }}>
                        {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : app.email || `#${app.id}`}
                      </span>
                      <LevelBadge level={app.level} />
                    </div>
                    <div style={{ fontSize: 16.5, color: "#555", marginBottom: 6 }}>
                      {tracks.join(" · ").toUpperCase() || "—"} · Test: {app.testScore}/10
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold" style={{ color: score >= 70 ? "#276749" : score >= 40 ? "#B7791F" : "#C53030", fontSize: 24 }}>{score.toFixed(1)}</span>
                      <TrendIndicator trend={app.xpTrend ?? 0} />
                      <button onClick={() => setScoreEditorApp(app)}
                        style={{ background: "#fff", border: "1px solid #000", color: "#000", padding: "4px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, cursor: "pointer" }}>
                        Score →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {evangelistMode && rows.length > 0 && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#F0FFF4", border: "1px solid #9AE6B4" }}>
          <span className="font-mono" style={{ color: "#276749", fontSize: 18 }}>
            ⚡ Top 12 highlighted in green — these are your current Token2049 Evangelist candidates based on Evangelist scoring weights.
            Scores update as you add X content and engagement data.
          </span>
        </div>
      )}

      {scoreEditorApp && (
        <ScoreEditor app={scoreEditorApp} onClose={() => setScoreEditorApp(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

// ── XP ENGINE TAB ───────────────────────────────────────────────────────────

type XPApplication = Application & {
  totalXP: number;
  xpTrend: number;
  xpC1: number; xpC2: number; xpC3: number; xpC4: number; xpC5: number;
  xpC6: number; xpC7: number; xpC8: number; xpC9: number; xpC10: number; xpC11: number;
  c4ContentQuality: number; c6CommunityValue: number; c7BuilderOutput: number;
  c8BuilderDepth: number; c9EngagementAuth: number; c10MissionAlign: number;
  c4UpdatedAt: Date | null; c6UpdatedAt: Date | null; c7UpdatedAt: Date | null;
  c8UpdatedAt: Date | null; c9UpdatedAt: Date | null; c10UpdatedAt: Date | null;
  xpUpdatedAt: Date | null;
};

type XPComponent = { key: string; label: string; max: number; color: string; adminScored?: boolean; rawKey?: string };
const XP_COMPONENTS: XPComponent[] = [
  { key: "c1", label: "C1 Post Freq", max: 12, color: "#00FF9D" },
  { key: "c2", label: "C2 Consistency", max: 10, color: "#00CC7D" },
  { key: "c3", label: "C3 Engagement", max: 10, color: "#00AA60" },
  { key: "c4", label: "C4 Content Quality", max: 12, color: "#7C3AED", adminScored: true, rawKey: "c4ContentQuality" },
  { key: "c5", label: "C5 TG Participation", max: 8, color: "#0891B2" },
  { key: "c6", label: "C6 Community Value", max: 10, color: "#D97706", adminScored: true, rawKey: "c6CommunityValue" },
  { key: "c7", label: "C7 Builder Output", max: 8, color: "#DC2626", adminScored: true, rawKey: "c7BuilderOutput" },
  { key: "c8", label: "C8 Builder Depth", max: 6, color: "#DB2777", adminScored: true, rawKey: "c8BuilderDepth" },
  { key: "c9", label: "C9 Engage Auth", max: 8, color: "#9333EA", adminScored: true, rawKey: "c9EngagementAuth" },
  { key: "c10", label: "C10 Mission Align", max: 7, color: "#2563EB", adminScored: true, rawKey: "c10MissionAlign" },
  { key: "c11", label: "C11 Test Score", max: 5, color: "#64748B" },
];

function XPScoreEditor({ app, onClose, onSaved }: { app: XPApplication; onClose: () => void; onSaved: () => void }) {
  const [scores, setScores] = useState({
    c4ContentQuality: app.c4ContentQuality ?? 0,
    c6CommunityValue: app.c6CommunityValue ?? 0,
    c7BuilderOutput: app.c7BuilderOutput ?? 0,
    c8BuilderDepth: app.c8BuilderDepth ?? 0,
    c9EngagementAuth: app.c9EngagementAuth ?? 0,
    c10MissionAlign: app.c10MissionAlign ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const updateQualitative = trpc.xp.updateQualitativeScores.useMutation({
    onSuccess: () => { toast.success("XP scores saved & recalculated"); setSaving(false); onSaved(); onClose(); },
    onError: (err) => { toast.error(err.message); setSaving(false); },
  });

  const adminComponents = XP_COMPONENTS.filter(c => c.adminScored);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-full overflow-y-auto" style={{ width: "100%", maxWidth: 480, background: "#0A0A0A", borderLeft: "1px solid #1E1E1E" }}>
        <div style={{ background: "#000", padding: "20px 28px", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #1E1E1E" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "#7C3AED", fontSize: 19.5 }}>XP QUALITATIVE SCORES</div>
              <h3 className="font-display font-bold uppercase" style={{ fontSize: 24, color: "#fff" }}>
                {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : `#${app.id}`}
              </h3>
              <div style={{ fontSize: 18, color: "#aaa", marginTop: 4 }}>Current totalXP: <span style={{ color: "#00FF9D", fontWeight: 700 }}>{(app.totalXP ?? 0).toFixed(1)}</span> XP</div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid #333", color: "#aaa", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 24 }}>×</button>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{ marginBottom: 20, padding: "12px 16px", background: "#111", border: "1px solid #222", fontSize: 18, color: "#bbb" }}>
            These are admin-scored qualitative components. They decay 25%/week if not updated.
            Auto-calculated components (C1, C2, C3, C5) are computed from X and Telegram data.
          </div>

          {adminComponents.map((comp) => {
            const rawKey = comp.rawKey as keyof typeof scores;
            const val = scores[rawKey] ?? 0;
            return (
              <div key={comp.key} style={{ marginBottom: 24 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold uppercase tracking-widest" style={{ color: comp.color, fontSize: 18 }}>{comp.label}</span>
                  <span className="font-mono font-bold" style={{ color: comp.color, fontSize: 24 }}>{val.toFixed(1)} / 10</span>
                </div>
                <div style={{ fontSize: 16.5, color: "#aaa", marginBottom: 6 }}>→ contributes up to {comp.max} XP pts after weighting</div>
                <ScoreBar value={val} max={10} color={comp.color} />
                <input type="range" min={0} max={10} step={0.5} value={val}
                  onChange={(e) => setScores(prev => ({ ...prev, [rawKey]: parseFloat(e.target.value) }))}
                  style={{ width: "100%", marginTop: 6, accentColor: comp.color }} />
              </div>
            );
          })}

          <button onClick={() => { setSaving(true); updateQualitative.mutate({ applicationId: app.id, ...scores }); }} disabled={saving}
            style={{ width: "100%", background: saving ? "#111" : "#7C3AED", border: "1px solid #7C3AED", padding: "14px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 21, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: saving ? "#aaa" : "#fff", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save & Recalculate XP →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function XPEngineTab() {
  const [xpEditor, setXpEditor] = useState<XPApplication | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const utils = trpc.useUtils();

  const { data: leaderboard, isLoading, refetch } = trpc.ambassador.leaderboard.useQuery({ evangelistMode: false });
  const recalculateAll = trpc.xp.recalculateAll.useMutation({
    onSuccess: (data) => {
      toast.success(`XP recalculated for ${data.updated} ambassadors`);
      setRecalculating(false);
      refetch();
    },
    onError: (err) => { toast.error(err.message); setRecalculating(false); },
  });

  const rows = (leaderboard ?? []) as XPApplication[];
  const trendIcon = (t: number) => t === 1 ? "↑" : t === -1 ? "↓" : "→";
  const trendColor = (t: number) => t === 1 ? "#00FF9D" : t === -1 ? "#e53e3e" : "#aaa";

  return (
    <div>
      {/* Header + Recalculate button */}
      <div style={{ background: "#fff", border: "1px solid #000", padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="font-mono font-bold uppercase tracking-widest mb-1" style={{ color: "#7C3AED", fontSize: 19.5 }}>🧮 XP ENGINE: COMPONENT BREAKDOWN</div>
          <div style={{ fontSize: 18, color: "#aaa" }}>C1–C3, C5 auto-calculated from X/TG data. C4, C6–C10 admin-scored (decay 25%/week). C11 static.</div>
        </div>
        <button
          onClick={() => { setRecalculating(true); recalculateAll.mutate(); }}
          disabled={recalculating}
          style={{ background: recalculating ? "#F5F5F5" : "#7C3AED", border: "1px solid #7C3AED", color: recalculating ? "#aaa" : "#fff", padding: "10px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: recalculating ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
          {recalculating ? "Recalculating..." : "⟳ Recalculate All XP"}
        </button>
      </div>

      {/* Component legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {XP_COMPONENTS.map(c => (
          <span key={c.key} style={{ fontSize: 16.5, fontFamily: "'JetBrains Mono', monospace", background: "#F5F5F5", border: `1px solid ${c.color}60`, color: c.color, padding: "2px 8px" }}>
            {c.label} <span style={{ color: "#aaa" }}>/{c.max}</span>
          </span>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
      {/* Table header */}
      <div style={{ background: "#000", border: "1px solid #000", borderBottom: "none" }}>
        <div className="hidden md:grid items-center" style={{ gridTemplateColumns: "40px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 60px 60px 70px 70px", minWidth: 900, padding: "10px 16px", gap: 6 }}>
          {["#", "Ambassador", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "TOTAL XP", ""].map((h) => (
            <div key={h} className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 15 }}>{h}</div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ border: "1px solid #000", background: "#fff" }}>
        {isLoading ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>Loading...</div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>No ambassadors yet. Click Recalculate All XP to compute scores.</div>
          </div>
        ) : (
          rows.map((app, idx) => {
            const components = [app.xpC1, app.xpC2, app.xpC3, app.xpC4, app.xpC5, app.xpC6, app.xpC7, app.xpC8, app.xpC9, app.xpC10, app.xpC11];
            const maxes = [12, 10, 14, 12, 8, 10, 8, 6, 8, 7, 5];
            const totalXP = app.totalXP ?? 0;
            return (
              <div key={app.id}
                style={{ borderBottom: idx < rows.length - 1 ? "1px solid #EEE" : "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F9F9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                {/* Desktop */}
                <div className="hidden md:grid items-center" style={{ gridTemplateColumns: "40px 1fr 60px 60px 60px 60px 60px 60px 60px 60px 60px 60px 60px 70px 70px", padding: "12px 16px", gap: 6 }}>
                  <div className="font-mono" style={{ color: "#aaa", fontSize: 18 }}>#{idx + 1}</div>
                  <div>
                    <div className="font-mono font-bold" style={{ color: "#000", fontSize: 18 }}>
                      {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : app.email || `#${app.id}`}
                    </div>
                    <div style={{ fontSize: 15, color: "#aaa" }}>Test: {app.testScore}/10 · {app.xpUpdatedAt ? `Updated ${new Date(app.xpUpdatedAt).toLocaleDateString()}` : "Never calculated"}</div>
                  </div>
                  {components.map((val, i) => (
                    <div key={i}>
                      <div className="font-mono" style={{ color: (val ?? 0) > 0 ? "#000" : "#AAA", fontSize: 18, fontWeight: 700 }}>
                        {(val ?? 0).toFixed(1)}
                      </div>
                      <div style={{ height: 2, background: "#DDD", marginTop: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, ((val ?? 0) / maxes[i]) * 100)}%`, background: "#000", opacity: 0.5 }} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold" style={{ color: "#000", fontSize: 21 }}>
                      {totalXP.toFixed(1)}
                    </span>
                    <span style={{ color: trendColor(app.xpTrend ?? 0), fontSize: 18, fontWeight: 700 }}>{trendIcon(app.xpTrend ?? 0)}</span>
                  </div>
                  <button onClick={() => setXpEditor(app)}
                    style={{ background: "#fff", border: "1px solid #7C3AED", color: "#7C3AED", padding: "3px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Edit
                  </button>
                </div>
                {/* Mobile */}
                <div className="flex items-start gap-3 md:hidden" style={{ padding: "12px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div className="font-mono font-bold" style={{ color: "#000", fontSize: 18 }}>
                      {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : `#${app.id}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold" style={{ color: "#000", fontSize: 24 }}>{totalXP.toFixed(1)} XP</span>
                      <span style={{ color: trendColor(app.xpTrend ?? 0), fontSize: 21 }}>{trendIcon(app.xpTrend ?? 0)}</span>
                    </div>
                    <button onClick={() => setXpEditor(app)}
                      style={{ marginTop: 6, background: "#fff", border: "1px solid #7C3AED", color: "#7C3AED", padding: "4px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, cursor: "pointer" }}>
                      Edit XP Scores
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      </div>
      {xpEditor && (
        <XPScoreEditor
          app={xpEditor}
          onClose={() => setXpEditor(null)}
          onSaved={() => { refetch(); utils.ambassador.leaderboard.invalidate(); }}
        />
      )}
    </div>
  );
}

// ── COMMS PLAYBOOK TAB ──────────────────────────────────────────────────────

const COMMS_TEMPLATES = [
  {
    category: "02 // PROGRAM ANNOUNCEMENTS",
    templates: [
      {
        id: "xp-announcement",
        label: "XP System Live: Channel Announcement",
        trigger: "When XP system goes live. Post in ambassador channel.",
        text: `XP is now live on the Ambassador leaderboard. Every contribution you make is visible. Every post, every community action, every piece of content. The leaderboard reflects what you do today. XP is earned through sustained contribution across X, Telegram, and the ecosystems you operate in. XP is how contribution becomes visible. The leaderboard is live. Full XP breakdown at /xp.`,
      },
      {
        id: "evangelist-announcement",
        label: "Evangelist Badge Live: Channel Announcement",
        trigger: "After awarding first Evangelist badges. Post in ambassador channel.",
        text: `The Evangelist badge is live. Evangelists are ambassadors who carry the protocol at the highest level. They are the voice of the protocol in the rooms that matter. The badge is a standard. Evangelists are invited to major industry events. The ambassadors who carry the Evangelist badge into that month represent the protocol on the world stage. The badge reflects sustained commitment. It stays active as long as you do. Thank you for your contribution.`,
      },
    ],
  },
  {
    category: "03 // EVANGELIST LIFECYCLE",
    templates: [
      {
        id: "badge-award-a",
        label: "Badge Award: Variant A (Active Ambassador)",
        trigger: "Active ambassador. Consistent posting. Obvious choice.",
        text: `You have been recognized as an Evangelist. The badge is live on your profile. This is something you earned. Your consistency, your content, and the work you have put into the protocol ecosystem made this an obvious decision. Token2049 Singapore is in October. Evangelists who carry the badge into that month represent the protocol at the event. Flight, accommodation, and expenses covered. Between now and then, Evangelists set the pace. That means staying visible. Posting about the protocol. Being present in the community. You have been doing exactly that. Keep going. The badge reflects who you are today. It stays active as long as you do. Thank you for your contribution.`,
      },
      {
        id: "badge-award-b",
        label: "Badge Award: Variant B (Quiet Ambassador)",
        trigger: "Ambassador with strong quality but lower visibility. Needs activation.",
        text: `You have been recognized as an Evangelist. The badge is live on your profile. This means we see in you the kind of commitment and clarity that defines how the protocol shows up in the world. Between now and then, Evangelists set the pace for the rest of the ambassador network. That means staying visible. Posting about the protocol. Being present in the community. Consistently. The community watches who carries the badge and they follow that lead. The badge reflects who you are today. It stays active as long as you do.`,
      },
      {
        id: "badge-award-c",
        label: "Badge Award: Variant C (Told Early + Went Quiet)",
        trigger: "Ambassador who was told they were on the shortlist but went quiet. Needs re-engagement.",
        text: `You have been recognized as an Evangelist. The badge is live on your profile. We told you early because we meant it. What we saw in you was real. That has not changed. Token2049 Singapore is in October. Evangelists who carry the badge into that month represent the protocol at the event. Flight, accommodation, and expenses covered. Between now and then, there is one expectation. Evangelists are visible. They post about the protocol. They are present in the community. They set the standard that others follow. That is what the badge means. Not a single moment, but a sustained commitment. The badge reflects who you are today. It stays active as long as you do. We are looking forward to seeing you back in rhythm.`,
      },
      {
        id: "warning-checkin",
        label: "Warning Check-In (Consistency Dropping)",
        trigger: "Internal: Consistency block below 15/30 or trend falling. First flag. Optional warm check-in.",
        text: `Hey [name]. Checking in. Things have been quieter on your end recently. No stress. Life happens. The Evangelist standard is sustained presence. The community notices when you show up, and they notice when you do not. We would like to see you back in rhythm. If there is anything on our end we can help with, let us know.`,
      },
      {
        id: "badge-strip",
        label: "Badge Strip (14 Days Below Floor)",
        trigger: "Internal: Below consistency floor for 14 consecutive days. Badge toggled off. Badge disappears from profile. No public announcement.",
        text: `Hey [name]. We have stepped back on the Evangelist badge for now. This reflects the standard the badge carries. Evangelists represent sustained, visible commitment, and the activity level over the past few weeks has moved away from that standard. Your ambassador status is fully intact. Your XP, your rank, your profile. All unchanged. If the momentum comes back, the badge can too. The door is open. We are rooting for you.`,
      },
      {
        id: "badge-re-award",
        label: "Badge Re-Award (Came Back)",
        trigger: "Ambassador returned to consistency after badge strip.",
        text: `You came back. That says everything. The Evangelist badge is back on your profile. You know what it means and what it takes. We did not have to tell you twice.`,
      },
      {
        id: "final-confirmation",
        label: "Final Confirmation (September Lock)",
        trigger: "Internal: First week of September. Roster locked. Badge holders get the commitment. Flights not booked until person confirms.",
        text: `It is official. You are confirmed as an Evangelist for Token2049 Singapore, October 2026. You held the standard. You showed up when it was quiet and when it was loud. That is why you are here. Flight and accommodation details will follow in the coming weeks. In the meantime, keep doing what got you here. The community is watching, and they will follow your lead. Thank you for your contribution.`,
      },
      {
        id: "public-lock-announcement",
        label: "Public Lock Announcement (Channel)",
        trigger: "Post in ambassador channel after September roster lock.",
        text: `The Evangelist cohort for the upcoming event has been confirmed. These ambassadors carried the standard from the day they were recognized. Thank you for your contribution.`,
      },
    ],
  },
  {
    category: "04 // MISSION ALIGNMENT ESCALATION",
    templates: [
      {
        id: "mission-step1",
        label: "Step 1: Initial DM (Day 1)",
        trigger: "Mission alignment score drops to 0-2. Inaccurate content detected.",
        text: `Hey [name]. We need to flag something. Some of the recent content about the protocol contains claims that do not align with what the protocol actually does. We take accuracy seriously because our ambassadors are how people learn about the protocol. If the information is wrong, the trust breaks. We have flagged the specific posts. Please review and correct them. If you are unsure about any technical detail, check with us first. We would rather you ask than publish something inaccurate. The ambassador title carries weight because the people who hold it are credible. That credibility is mutual.`,
      },
      {
        id: "mission-step4",
        label: "Step 4 — Program Removal",
        trigger: "Pattern continues after direct call. Admin discretion. No public announcement.",
        text: `Your participation in the Ambassador Program has concluded. We wish you well.`,
      },
    ],
  },
];

// ── FEATURED POSTS TAB ────────────────────────────────────────────────────────────────────
type FeaturedPost = {
  id: number;
  applicationId: number;
  tweetUrl: string;
  caption: string | null;
  position: number;
  adminNote: string | null;
  isVisible: number;
  createdAt: Date;
  updatedAt: Date;
};

function FeaturedPostsTab() {
  const utils = trpc.useUtils();
  const { data: allPosts = [], isLoading } = trpc.featuredPosts.list.useQuery(undefined);
  const { data: ambassadors = [] } = trpc.ambassador.publicLeaderboard.useQuery();

  const [selectedAmbId, setSelectedAmbId] = useState<number | null>(null);
  const [editPost, setEditPost] = useState<FeaturedPost | null>(null);
  const [newTweetUrl, setNewTweetUrl] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newAdminNote, setNewAdminNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const upsert = trpc.featuredPosts.upsert.useMutation({
    onSuccess: () => {
      utils.featuredPosts.list.invalidate();
      setEditPost(null);
      setShowAddForm(false);
      setNewTweetUrl("");
      setNewCaption("");
      setNewAdminNote("");
      toast.success("Post saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.featuredPosts.delete.useMutation({
    onSuccess: () => { utils.featuredPosts.list.invalidate(); toast.success("Post removed"); },
    onError: (e) => toast.error(e.message),
  });

  const reorder = trpc.featuredPosts.reorder.useMutation({
    onSuccess: () => utils.featuredPosts.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  // Posts for the selected ambassador
  const ambPosts = selectedAmbId
    ? (allPosts as FeaturedPost[]).filter((p) => p.applicationId === selectedAmbId).sort((a, b) => a.position - b.position)
    : [];

  // Ambassador list from leaderboard
  type AmbEntry = { id: number; twitterHandle: string | null; displayHandle: string | null; totalXP: number | null; totalScore: number };
  const ambList = (ambassadors as AmbEntry[]).map((a) => ({
    id: a.id,
    handle: (a.displayHandle || a.twitterHandle || `#${a.id}`).replace(/^@/, ""),
    postCount: (allPosts as FeaturedPost[]).filter((p) => p.applicationId === a.id).length,
  }));

  function movePost(post: FeaturedPost, dir: -1 | 1) {
    const sorted = [...ambPosts];
    const idx = sorted.findIndex((p) => p.id === post.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const ids = sorted.map((p) => p.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    reorder.mutate({ applicationId: post.applicationId, orderedIds: ids });
  }

  const inputStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #CCC", color: "#000",
    fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5,
    padding: "8px 12px", width: "100%", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700,
    color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, display: "block",
  };

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
        FEATURED POSTS — Manage curated posts shown on each ambassador’s public profile
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, alignItems: "start" }}>
        {/* Left: Ambassador list */}
        <div style={{ border: "1px solid #E8E8E8", background: "#fff" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E8E8E8", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            AMBASSADORS ({ambList.length})
          </div>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#bbb", fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>LOADING...</div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {ambList.map((a) => (
                <div key={a.id}
                  onClick={() => { setSelectedAmbId(a.id); setShowAddForm(false); setEditPost(null); }}
                  style={{
                    padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F0F0F0",
                    background: selectedAmbId === a.id ? "#F5F5F5" : "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 600, color: "#000" }}>@{a.handle}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, color: "#bbb", marginTop: 2 }}>{a.postCount} post{a.postCount !== 1 ? "s" : ""}</div>
                  </div>
                  {selectedAmbId === a.id && <span style={{ color: "#00AA60", fontWeight: 700, fontSize: 24 }}>›</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Posts for selected ambassador */}
        <div>
          {!selectedAmbId ? (
            <div style={{ padding: 40, textAlign: "center", color: "#bbb", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, border: "1px solid #E8E8E8" }}>
              SELECT AN AMBASSADOR TO MANAGE THEIR POSTS
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, color: "#000" }}>
                  @{ambList.find((a) => a.id === selectedAmbId)?.handle} — {ambPosts.length} FEATURED POST{ambPosts.length !== 1 ? "S" : ""}
                </div>
                <button
                  onClick={() => { setShowAddForm(!showAddForm); setEditPost(null); }}
                  style={{ background: "#000", color: "#fff", border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 20px", cursor: "pointer" }}
                >
                  {showAddForm ? "CANCEL" : "+ ADD POST"}
                </button>
              </div>

              {/* Add form */}
              {showAddForm && (
                <div style={{ background: "#F9F9F9", border: "1px solid #E8E8E8", padding: 20, marginBottom: 16 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>ADD NEW FEATURED POST</div>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Tweet URL *</label>
                      <input style={inputStyle} placeholder="https://x.com/handle/status/..." value={newTweetUrl} onChange={(e) => setNewTweetUrl(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Caption (optional override)</label>
                      <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} placeholder="Leave blank to use scraped tweet text" value={newCaption} onChange={(e) => setNewCaption(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Admin Note (why this post is featured)</label>
                      <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} placeholder="e.g. Best thread on the protocol’s architecture, high engagement" value={newAdminNote} onChange={(e) => setNewAdminNote(e.target.value)} />
                    </div>
                    <button
                      disabled={!newTweetUrl.trim() || upsert.isPending}
                      onClick={() => upsert.mutate({ applicationId: selectedAmbId!, tweetUrl: newTweetUrl.trim(), caption: newCaption.trim() || null, adminNote: newAdminNote.trim() || null, position: ambPosts.length + 1 })}
                      style={{ background: "#000", color: "#fff", border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 24px", cursor: "pointer", alignSelf: "flex-start", opacity: !newTweetUrl.trim() ? 0.4 : 1 }}
                    >
                      {upsert.isPending ? "SAVING..." : "SAVE POST"}
                    </button>
                  </div>
                </div>
              )}

              {/* Post list */}
              {ambPosts.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#bbb", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, border: "1px solid #E8E8E8" }}>NO FEATURED POSTS YET</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {ambPosts.map((post, idx) => (
                    <div key={post.id} style={{ background: "#fff", border: "1px solid #E8E8E8", padding: 16 }}>
                      {editPost?.id === post.id ? (
                        // Edit mode
                        <div style={{ display: "grid", gap: 10 }}>
                          <div>
                            <label style={labelStyle}>Tweet URL</label>
                            <input style={inputStyle} value={editPost.tweetUrl} onChange={(e) => setEditPost({ ...editPost, tweetUrl: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Caption</label>
                            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={editPost.caption ?? ""} onChange={(e) => setEditPost({ ...editPost, caption: e.target.value || null })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Admin Note</label>
                            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={editPost.adminNote ?? ""} onChange={(e) => setEditPost({ ...editPost, adminNote: e.target.value || null })} />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Visible</label>
                            <input type="checkbox" checked={editPost.isVisible === 1} onChange={(e) => setEditPost({ ...editPost, isVisible: e.target.checked ? 1 : 0 })} />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => upsert.mutate({ id: editPost.id, applicationId: editPost.applicationId, tweetUrl: editPost.tweetUrl, caption: editPost.caption, adminNote: editPost.adminNote, position: editPost.position, isVisible: editPost.isVisible })} disabled={upsert.isPending} style={{ background: "#000", color: "#fff", border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, padding: "8px 20px", cursor: "pointer" }}>{upsert.isPending ? "SAVING..." : "SAVE"}</button>
                            <button onClick={() => setEditPost(null)} style={{ background: "transparent", color: "#aaa", border: "1px solid #CCC", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, padding: "8px 20px", cursor: "pointer" }}>CANCEL</button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#aaa", background: "#F0F0F0", padding: "2px 8px" }}>#{post.position}</span>
                              {post.isVisible === 0 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#EF4444", background: "#FFF5F5", border: "1px solid #FEB2B2", padding: "2px 8px" }}>HIDDEN</span>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {/* Move up/down */}
                              <button onClick={() => movePost(post, -1)} disabled={idx === 0} style={{ background: "#F5F5F5", border: "1px solid #E8E8E8", color: "#000", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, padding: "4px 10px", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                              <button onClick={() => movePost(post, 1)} disabled={idx === ambPosts.length - 1} style={{ background: "#F5F5F5", border: "1px solid #E8E8E8", color: "#000", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, padding: "4px 10px", cursor: idx === ambPosts.length - 1 ? "not-allowed" : "pointer", opacity: idx === ambPosts.length - 1 ? 0.3 : 1 }}>↓</button>
                              <button onClick={() => setEditPost(post)} style={{ background: "#F5F5F5", border: "1px solid #E8E8E8", color: "#000", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, padding: "4px 10px", cursor: "pointer" }}>EDIT</button>
                              <button onClick={() => { if (confirm("Remove this featured post?")) del.mutate({ id: post.id }); }} style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", color: "#C53030", fontFamily: "'JetBrains Mono', monospace", fontSize: 18, padding: "4px 10px", cursor: "pointer" }}>DEL</button>
                            </div>
                          </div>
                          <a href={post.tweetUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: "#2563EB", wordBreak: "break-all", display: "block", marginBottom: 6 }}>{post.tweetUrl}</a>
                          {post.caption && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 19.5, color: "#aaa", background: "#F9F9F9", padding: "8px 12px", marginBottom: 6, borderLeft: "3px solid #E8E8E8" }}>{post.caption}</div>}
                          {post.adminNote && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, color: "#aaa", marginTop: 4 }}>NOTE: {post.adminNote}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CommsPlaybookTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 16.5, marginBottom: 8 }}>DOC 03 // COMMS PLAYBOOK</div>
        <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: 30 }}>Comms Playbook</div>
        <div className="font-mono" style={{ color: "#aaa", fontSize: 18, marginTop: 4 }}>How the program speaks. What ambassadors hear.</div>
      </div>

      {/* Voice rules */}
      <div style={{ background: "#f5f5f5", border: "1px solid #000", padding: "16px 20px", marginBottom: 32 }}>
        <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: 16.5, color: "#aaa", marginBottom: 8 }}>01 // VOICE RULES</div>
        <div className="font-mono" style={{ fontSize: 18, lineHeight: 1.7, color: "#aaa" }}>
          Short declarative sentences. Present tense. The program states what is, not what could be.<br />
          No exclamation marks. No em dashes. No hype adjectives. Agency on the ambassador.
        </div>
      </div>

      {/* Templates */}
      {COMMS_TEMPLATES.map((section) => (
        <div key={section.category} style={{ marginBottom: 40 }}>
          <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: 16.5, color: "#aaa", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #000" }}>
            {section.category}
          </div>
          {section.templates.map((t) => (
            <div key={t.id} style={{ border: "1px solid #000", marginBottom: 12 }}>
              {/* Template header */}
              <div style={{ background: "#000", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: 18, color: "#fff" }}>{t.label}</div>
                <button
                  onClick={() => handleCopy(t.id, t.text)}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5,
                    color: copied === t.id ? "#000" : "#fff",
                    background: copied === t.id ? "#00FF9D" : "transparent",
                    border: "1px solid",
                    borderColor: copied === t.id ? "#00FF9D" : "#444",
                    padding: "4px 12px", cursor: "pointer",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    transition: "all 0.15s",
                  }}
                >
                  {copied === t.id ? "COPIED" : "COPY"}
                </button>
              </div>
              {/* Trigger note */}
              <div style={{ background: "#f9f9f9", padding: "8px 16px", borderBottom: "1px solid #eee" }}>
                <span className="font-mono" style={{ fontSize: 15, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em" }}>TRIGGER: </span>
                <span className="font-mono" style={{ fontSize: 16.5, color: "#aaa" }}>{t.trigger}</span>
              </div>
              {/* Template text */}
              <div style={{ padding: "16px", background: "#fff" }}>
                <pre style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 19.5,
                  color: "#222", lineHeight: 1.8,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  margin: 0,
                }}>{t.text}</pre>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Cohort launch sequence */}
      <div style={{ border: "1px solid #000", padding: "20px", background: "#f5f5f5", marginBottom: 40 }}>
        <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: 16.5, color: "#aaa", marginBottom: 12 }}>COHORT LAUNCH SEQUENCE</div>
        {[
          "1. Publish the XP system page at YOUR_APP_DOMAIN/xp.",
          "2. Award all 4 Evangelist badges in the admin panel.",
          "3. Send individual DMs to the 4 badge recipients (Variants A, B, or C as appropriate).",
          "4. Post the XP announcement in the ambassador channel.",
          "5. Post the Evangelist announcement in the ambassador channel.",
          "6. The leaderboard updates live. Everyone sees the badges and the XP scores simultaneously.",
        ].map((step, i) => (
          <div key={i} className="font-mono" style={{ fontSize: 18, color: "#aaa", lineHeight: 1.8 }}>{step}</div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ADMIN PAGE ──────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"applications" | "rankings" | "xtracker" | "telegram" | "xp" | "comms" | "posts" | "aispend" | "verifications">("applications");
  const { data: aiSpendData } = trpc.aiStudio.adminSpend.useQuery(undefined, { staleTime: 60000, enabled: activeTab === "aispend" });
  const { data: verificationsData, refetch: refetchVerifications } = trpc.aiStudio.adminVerifications.useQuery(undefined, { staleTime: 30000, enabled: activeTab === "verifications" });
  const reviewVerifMut = trpc.aiStudio.reviewVerification.useMutation({
    onSuccess: () => { refetchVerifications(); toast.success("Verification updated."); },
    onError: (e) => toast.error(e.message),
  });
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [localApps, setLocalApps] = useState<Application[] | null>(null);

  const { data: stats } = trpc.ambassador.stats.useQuery();

  const { data: applications, isLoading: appsLoading, error: appsError } = trpc.ambassador.list.useQuery(
    { status: statusFilter !== "all" ? statusFilter : undefined }
  );

  const displayApps = (applications ?? localApps ?? []) as Application[];

  const handleStatusUpdate = (id: number, status: Status, notes?: string) => {
    setLocalApps((prev) =>
      prev ? prev.map((a) => a.id === id ? { ...a, status, adminNotes: notes ?? a.adminNotes, updatedAt: new Date() } : a) : null
    );
    if (selectedApp?.id === id) {
      setSelectedApp((prev) => prev ? { ...prev, status, adminNotes: notes ?? prev.adminNotes } : null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}>
        <div className="font-mono uppercase tracking-widest" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}>
        <div style={{ textAlign: "center" }}>
          <div className="font-mono uppercase tracking-widest mb-4" style={{ color: "#aaa", fontSize: 19.5 }}>YOUR PROTOCOL // ADMIN</div>
          <h1 className="font-display font-bold uppercase mb-6" style={{ fontSize: 42, color: "#fff" }}>Authentication Required</h1>
          <a href={getLoginUrl("/admin")} className="btn-brand-primary">Sign In →</a>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}>
        <div style={{ textAlign: "center" }}>
          <div className="font-mono uppercase tracking-widest mb-4" style={{ color: "#e53e3e", fontSize: 19.5 }}>ACCESS DENIED</div>
          <h1 className="font-display font-bold uppercase mb-4" style={{ fontSize: 36, color: "#fff" }}>Admin Access Required</h1>
          <p className="text-sm mb-6" style={{ color: "#aaa" }}>Your account does not have admin privileges.</p>
          <a href="/" className="btn-brand-outline">← Back to Home</a>
        </div>
      </div>
    );
  }

  const filteredApps = displayApps.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ background: "#F5F5F5", minHeight: "100vh" }}>
      {/* Top nav */}
      <div style={{ background: "#000", borderBottom: "1px solid #1E1E1E", padding: "16px 0", position: "sticky", top: 0, zIndex: 20 }}>
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="font-mono font-bold uppercase tracking-widest" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>YOUR PROTOCOL</div>
            <span style={{ color: "#aaa" }}>/</span>
            <div className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>AMBASSADOR ADMIN</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>{user.name ?? user.email}</span>
            <a href="/" className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5, textDecoration: "none", border: "1px solid #333", padding: "4px 10px" }}>← Landing Page</a>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "40px 0" }}>
        <div style={{ marginBottom: 32 }}>
          <div className="font-mono font-bold uppercase tracking-widest mb-2" style={{ color: "var(--brand-green)", fontSize: 19.5 }}>DASHBOARD</div>
          <h1 className="font-display font-bold uppercase tracking-tight" style={{ fontSize: 48, color: "#000" }}>Ambassador Program</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 mb-8" style={{ background: "#000", border: "1px solid #000" }}>
          <StatCard label="Total" value={stats?.total ?? 0} accent />
          <StatCard label="Promoted" value={stats?.pending ?? 0} />
          <StatCard label="Ambassadors" value={stats?.approved ?? 0} />
          <StatCard label="Rejected" value={stats?.rejected ?? 0} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid #000" }}>
          {(["applications", "rankings", "xtracker", "telegram", "xp", "posts", "comms", "aispend", "verifications"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: activeTab === tab ? "#000" : "transparent", border: "1px solid #000", borderBottom: activeTab === tab ? "1px solid #000" : "none", color: activeTab === tab ? "#fff" : "#aaa", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 24px", cursor: "pointer", marginBottom: activeTab === tab ? -1 : 0 }}>
              {tab === "rankings" ? "⚡ Rankings" : tab === "xtracker" ? "🐦 X Tracker" : tab === "telegram" ? "💬 Telegram" : tab === "xp" ? "🧮 XP Engine" : tab === "comms" ? "📋 Comms Playbook" : tab === "posts" ? "📌 Posts" : tab === "aispend" ? "🤖 AI Spend" : "Applications"}
            </button>
          ))}
        </div>

        {/* Applications tab */}
        {activeTab === "applications" && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6" style={{ background: "#fff", border: "1px solid #000", padding: "16px 20px" }}>
              <span className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>Filter by Status:</span>
              <div className="flex gap-1.5">
                {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={{ background: statusFilter === s ? "#000" : "transparent", border: "1px solid", borderColor: statusFilter === s ? "#000" : "#DDD", color: statusFilter === s ? "#fff" : "#aaa", fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>
                    {s === "all" ? "All" : s === "approved" ? "Ambassador" : s === "pending" ? "Promoted" : s}
                  </button>
                ))}
              </div>
              <div className="ml-auto">
                <span className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>{filteredApps.length} result{filteredApps.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            <div style={{ border: "1px solid #000", background: "#fff" }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: "60px 1fr 100px 110px 70px 110px 110px", background: "#000", padding: "10px 20px", gap: 16 }}>
                {["#", "Tracks", "Score", "Status", "XP", "Scraped", "Applied"].map((h) => (
                  <div key={h} className="font-mono font-bold uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>{h}</div>
                ))}
              </div>

              {appsLoading ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div className="font-mono uppercase tracking-widest" style={{ color: "#aaa", fontSize: 19.5 }}>Loading applications...</div>
                </div>
              ) : appsError ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div className="font-mono uppercase tracking-widest" style={{ color: "#e53e3e", fontSize: 19.5 }}>{appsError.message}</div>
                </div>
              ) : filteredApps.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div className="font-mono uppercase tracking-widest mb-2" style={{ color: "#aaa", fontSize: 19.5 }}>No applications found</div>
                  <div className="text-sm" style={{ color: "#AAA" }}>Adjust your filters or check back later.</div>
                </div>
              ) : (
                filteredApps.map((app, idx) => {
                  const statusStyle = STATUS_STYLES[app.status];
                  const tracks = (app.tracks as string[] | null) ?? [];
                  return (
                    <div key={app.id} onClick={() => setSelectedApp(app)} className="grid"
                      style={{ gridTemplateColumns: "1fr", padding: "16px 20px", borderBottom: idx < filteredApps.length - 1 ? "1px solid #EEE" : "none", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F9F9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>
                      <div className="hidden md:grid items-center gap-4" style={{ gridTemplateColumns: "60px 1fr 100px 110px 70px 110px 110px" }}>
                        <span className="font-mono" style={{ color: "#AAA", fontSize: 19.5 }}>#{app.rowNum ?? app.id}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="font-display font-bold text-sm" style={{ color: "#000" }}>{tracks.join(" · ").toUpperCase() || "—"}</div>
                            {app.isEvangelist === 1 && (
                              <span className="font-mono font-bold uppercase" style={{ fontSize: 19.5, background: "#00FF9D", color: "#000", padding: "1px 6px", letterSpacing: "0.08em" }}>Evangelist</span>
                            )}
                          </div>
                          <div className="text-xs" style={{ color: "#aaa" }}>
                            {app.twitterHandle ? `@${app.twitterHandle.replace(/^@/, "")}` : app.telegramHandle ? `t.me/${app.telegramHandle}` : "No social"}
                          </div>
                        </div>
                        <span className="font-mono font-bold" style={{ fontSize: 19.5, color: app.testScore === 10 ? "#276749" : "#C53030" }}>{app.testScore} / 10</span>
                        <span className="font-mono font-bold uppercase" style={{ fontSize: 19.5, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, padding: "3px 8px", display: "inline-block" }}>{app.status}</span>
                        <span className="font-mono font-bold" style={{ fontSize: 19.5, color: (app.totalXP ?? 0) >= 50 ? "#00FF9D" : (app.totalXP ?? 0) >= 20 ? "#F6E05E" : "#AAA" }}>{(app.totalXP ?? 0).toFixed(0)}</span>
                        <div className="font-mono" style={{ color: app.lastScrapedAt ? "#00FF9D" : "#aaa", fontSize: 11, lineHeight: 1.3 }}>
                          {app.lastScrapedAt ? new Date(app.lastScrapedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + new Date(app.lastScrapedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </div>
                        <div className="font-mono uppercase tracking-widest" style={{ color: "#AAA", fontSize: 19.5 }}>
                          {new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-4 md:hidden">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="font-display font-bold text-sm" style={{ color: "#000" }}>{tracks.join(", ") || "—"}</div>
                            {app.isEvangelist === 1 && (
                              <span className="font-mono font-bold uppercase" style={{ fontSize: 19.5, background: "#00FF9D", color: "#000", padding: "1px 6px", letterSpacing: "0.08em" }}>Evangelist</span>
                            )}
                          </div>
                          <div className="text-xs" style={{ color: "#aaa" }}>Score: {app.testScore}/10</div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-mono font-bold uppercase" style={{ fontSize: 19.5, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, padding: "2px 6px" }}>{app.status}</span>
                          </div>
                        </div>
                        <div className="font-mono uppercase tracking-widest" style={{ color: "#AAA", fontSize: 19.5, whiteSpace: "nowrap" }}>
                          {new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Rankings tab */}
        {activeTab === "rankings" && <RankingsTab />}

        {/* X Tracker tab */}
        {activeTab === "xtracker" && <XTracker />}

        {/* Telegram Tracker tab */}
        {activeTab === "telegram" && (
          <div style={{ padding: "24px 0" }}>
            <TelegramTracker />
          </div>
        )}

        {/* XP Engine tab */}
        {activeTab === "xp" && <XPEngineTab />}

        {/* Posts tab */}
        {activeTab === "posts" && <FeaturedPostsTab />}

        {/* Comms Playbook tab */}
        {activeTab === "comms" && <CommsPlaybookTab />}
        {activeTab === "verifications" && (
          <div style={{ background: "#fff", border: "1px solid #000", padding: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>AI Studio — Access Verifications</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#555", marginBottom: 24 }}>Review and approve or reject contributor Studio access requests.</div>
            {!verificationsData || verificationsData.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, textTransform: "uppercase" }}>No verification requests yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #000" }}>
                    {["Email", "X Handle", "Telegram", "Submitted", "Status", "Actions"].map(h => (
                      <th key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(verificationsData as Array<{ id: number; email: string; xHandle: string; telegramHandle: string; submittedAt: number; status: string; notes: string | null }>).map((row, i) => {
                    const statusColor = row.status === "verified" ? "#22c55e" : row.status === "rejected" ? "#ef4444" : "#eab308";
                    const isPending = row.status === "pending";
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "10px 12px", color: "#000" }}>{row.email}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "10px 12px", color: "#555" }}>{row.xHandle}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "10px 12px", color: "#555" }}>{row.telegramHandle}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "10px 12px", color: "#888" }}>{new Date(row.submittedAt).toLocaleDateString()}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{row.status}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {isPending ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => reviewVerifMut.mutate({ id: row.id, status: "verified" })}
                                disabled={reviewVerifMut.isPending}
                                style={{ padding: "4px 14px", borderRadius: 4, cursor: "pointer", background: "#22c55e", border: "none", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}
                              >APPROVE</button>
                              <button
                                onClick={() => reviewVerifMut.mutate({ id: row.id, status: "rejected" })}
                                disabled={reviewVerifMut.isPending}
                                style={{ padding: "4px 14px", borderRadius: 4, cursor: "pointer", background: "#ef4444", border: "none", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}
                              >REJECT</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => reviewVerifMut.mutate({ id: row.id, status: "pending" as "verified" })}
                              disabled={reviewVerifMut.isPending}
                              style={{ padding: "4px 14px", borderRadius: 4, cursor: "pointer", background: "transparent", border: "1px solid #ccc", color: "#888", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                            >RESET</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "aispend" && (
          <div style={{ background: "#fff", border: "1px solid #000", padding: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>AI Studio — Video Spend</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#555", marginBottom: 24 }}>Monthly video-second usage per ambassador. Caps: Initiate 220s / Active 330s / Champion 550s / Elite 880s.</div>
            {!aiSpendData || aiSpendData.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, textTransform: "uppercase" }}>No video generations this month.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #000" }}>
                    {["Ambassador ID", "Tier", "Used (s)", "Cap (s)", "% Used", "Status"].map(h => (
                      <th key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(aiSpendData as Array<{ applicationId: number; capSeconds: number; secondsUsed: number; alert80Sent: number; alert95Sent: number; alert100Sent: number }>).map((row, i) => {
                    const pct = Math.min(1, row.secondsUsed / row.capSeconds);
                    const color = pct >= 1 ? "#ef4444" : pct >= 0.95 ? "#f97316" : pct >= 0.8 ? "#eab308" : "#22c55e";
                    const status = pct >= 1 ? "CAP REACHED" : pct >= 0.95 ? "95% ALERT" : pct >= 0.8 ? "80% ALERT" : "OK";
                    const tierLabel = row.capSeconds === 880 ? "ELITE" : row.capSeconds === 550 ? "CHAMPION" : row.capSeconds === 330 ? "ACTIVE" : "INITIATE";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, padding: "10px 12px", color: "#000" }}>#{row.applicationId}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, padding: "10px 12px", color: "#555" }}>{tierLabel}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, padding: "10px 12px", color: "#000", fontWeight: 700 }}>{row.secondsUsed.toFixed(1)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, padding: "10px 12px", color: "#555" }}>{row.capSeconds}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5, color, fontWeight: 700, minWidth: 40 }}>{(pct * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: 4 }}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {selectedApp && (
        <ApplicationDrawer app={selectedApp} onClose={() => setSelectedApp(null)} onStatusUpdate={handleStatusUpdate} />
      )}
    </div>
  );
}
