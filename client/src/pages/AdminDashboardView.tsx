import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { DashboardContent } from "./AmbassadorDashboard";

export default function AdminDashboardView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const id = params?.id ? parseInt(params.id, 10) : null;

  const { data: app, isLoading, error } = trpc.ambassador.getById.useQuery(
    { id: id! },
    { enabled: !!id && !isNaN(id!) && !!user && user.role === "admin" }
  );

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading...</div>
    </div>
  );

  if (!user) {
    window.location.href = getLoginUrl("/admin");
    return null;
  }

  if (user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, color: "#E74C3C", textTransform: "uppercase", marginBottom: 16 }}>Access Denied</div>
          <button onClick={() => navigate("/")} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#00FF9D", background: "none", border: "none", cursor: "pointer" }}>← Back to Home</button>
        </div>
      </div>
    );
  }

  if (!id || isNaN(id)) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, color: "#E74C3C", textTransform: "uppercase" }}>Invalid Application ID</div>
      </div>
    );
  }

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading Ambassador...</div>
    </div>
  );

  if (error || !app) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19.5, color: "#E74C3C", textTransform: "uppercase", marginBottom: 16 }}>Ambassador Not Found</div>
        <button onClick={() => navigate("/admin")} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#00FF9D", background: "none", border: "none", cursor: "pointer" }}>← Back to Admin</button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Admin back button */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 1000 }}>
        <button
          onClick={() => navigate("/admin")}
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#00FF9D",
            background: "rgba(0,0,0,0.85)", border: "1px solid #00FF9D33",
            padding: "8px 16px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
            backdropFilter: "blur(8px)",
          }}
        >
          ← Admin
        </button>
      </div>
      <DashboardContent app={app as Record<string, unknown>} />
    </div>
  );
}
