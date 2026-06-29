import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { createPortal } from "react-dom";

// ── Deal classification ───────────────────────────────────────────────────────
// Mirrors the original Free Credits → Cashback → Discount → Other order. The
// server already provides isNonCashback for sorting, but we re-classify the
// individual offer text so filter chips and tier-gating still work the way
// they did before the visual port.
type DealType = "free_credits" | "cashback" | "discount" | "other";

function classifyDeal(offer?: string, offer2?: string, savings?: string): DealType {
  const text = ((offer || "") + " " + (offer2 || "") + " " + (savings || "")).toLowerCase();
  if (
    text.includes("free credit") ||
    text.includes("credits") ||
    text.includes("free $") ||
    text.includes("get $") ||
    text.includes("free trial") ||
    text.includes("free month")
  )
    return "free_credits";
  if (text.includes("cashback") || text.includes("cash back")) return "cashback";
  if (text.includes("% off") || text.includes("discount")) return "discount";
  return "other";
}

const DEAL_TYPE_ORDER: DealType[] = ["free_credits", "cashback", "discount", "other"];

const DEAL_TYPE_META: Record<DealType, { label: string; description: string; tone: string }> = {
  free_credits: {
    label: "Free Credits",
    tone: "var(--green)",
    description: "Free credits or trial spend — no upfront cost.",
  },
  cashback: {
    label: "Cashback",
    tone: "#4d80d0",
    description: "Earn a percentage back on subscription spend.",
  },
  discount: {
    label: "Discount",
    tone: "#b58e1d",
    description: "Reduced pricing off standard partner rates.",
  },
  other: {
    label: "Other Deals",
    tone: "var(--ink-mute)",
    description: "Special partner arrangements and bonuses.",
  },
};

// ── Tier gate config ──────────────────────────────────────────────────────────
// level 0 = applicant, 1 = contributor, 2 = ambassador, 3+ = champion/elite
function getTierAccess(level: number): { unlockedTypes: DealType[]; gateMessage: string | null } {
  if (level <= 0) {
    return {
      unlockedTypes: [],
      gateMessage: "Apply to the Ambassador Program to unlock the Perks Vault.",
    };
  }
  if (level === 1) {
    return { unlockedTypes: ["free_credits"], gateMessage: null };
  }
  return { unlockedTypes: ["free_credits", "cashback", "discount", "other"], gateMessage: null };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface NNProduct {
  id: string;
  name: string;
  logo: string;
  shortDescription: string;
  offer: string;
  offer2?: string;
  estimateSavingText?: string;
  estimatedSavingMax?: number;
  signupLink?: string;
  sellerLink?: string;
  relationshipType: string;
  category: string;
  isNonCashback: boolean;
  isHidden?: boolean;
  isFeatured?: boolean;
}

// ── Coming Soon Modal ─────────────────────────────────────────────────────────
function ComingSoonModal({
  product,
  onClose,
}: {
  product: { name: string; offer: string; logo?: string } | null;
  onClose: () => void;
}) {
  if (!product) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,15,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          maxWidth: 460,
          width: "100%",
          padding: "36px 36px 28px",
          position: "relative",
          boxShadow: "0 20px 48px rgba(20,20,15,0.18), 0 8px 16px rgba(20,20,15,0.08)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "transparent",
            border: "none",
            color: "var(--ink-mute)",
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--green)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          · Ambassador Perks
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          {product.logo && (
            <div
              style={{
                width: 48,
                height: 48,
                background: "var(--paper-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={product.logo}
                alt={product.name}
                style={{ width: 36, height: 36, objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div
            className="serif"
            style={{ fontSize: 24, fontWeight: 500, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-0.01em" }}
          >
            {product.name}
          </div>
        </div>

        {product.offer && (
          <div
            className="mono"
            style={{
              display: "inline-block",
              background: "rgba(0,200,134,0.08)",
              border: "1px solid rgba(0,200,134,0.35)",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: "var(--green)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 22,
            }}
          >
            {product.offer}
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            className="serif"
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Coming <em style={{ fontStyle: "italic" }}>Soon.</em>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0, maxWidth: 360 }}>
            This deal is being set up exclusively for ambassadors. Once live, you'll be able to claim it
            directly from this vault.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5, margin: "4px 0 0" }}>
            Check back soon — or keep an eye on your ambassador updates.
          </p>
        </div>

        <button
          onClick={onClose}
          className="paper-btn-ghost"
          style={{
            marginTop: 26,
            width: "100%",
            justifyContent: "center",
            fontSize: 13,
            padding: "12px 18px",
          }}
        >
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: NNProduct;
  dealType: DealType;
  isAdmin?: boolean;
  onToggleHide?: (productId: string, hide: boolean) => void;
  onToggleFeatured?: (productId: string, featured: boolean) => void;
  onClaimClick?: (product: NNProduct) => void;
  isTogglingHideId?: string | null;
  isTogglingFeaturedId?: string | null;
}

function ProductCard({
  product,
  dealType,
  isAdmin,
  onToggleHide,
  onToggleFeatured,
  onClaimClick,
  isTogglingHideId,
  isTogglingFeaturedId,
}: ProductCardProps) {
  const isFeatured = product.isFeatured ?? false;
  const isHidden = product.isHidden ?? false;
  const isTogglingHide = isTogglingHideId === product.id;
  const isTogglingFeatured = isTogglingFeaturedId === product.id;
  const meta = DEAL_TYPE_META[dealType];

  const ribbonLabel = isFeatured ? "★ Featured" : `✓ ${meta.label}`;

  return (
    <div
      className={`perk-card unlocked${isFeatured ? " featured" : ""}${isHidden ? " hidden-card" : ""}`}
    >
      <span className="perk-ribbon">{ribbonLabel}</span>

      {isAdmin && isHidden && <span className="perk-hidden-badge">Hidden</span>}

      <div className="perk-card-top">
        {product.logo ? (
          <div className="perk-logo">
            <img
              src={product.logo}
              alt={product.name}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = "none";
                const parent = img.parentElement;
                if (parent) parent.textContent = product.name.charAt(0).toUpperCase();
              }}
            />
          </div>
        ) : (
          <div className="perk-logo perk-logo-fallback">{product.name.charAt(0).toUpperCase()}</div>
        )}

        {isAdmin && (
          <div className="perk-admin-controls">
            {onToggleFeatured && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFeatured(product.id, !isFeatured);
                }}
                disabled={isTogglingFeatured}
                title={isFeatured ? "Remove from featured" : "Feature this product (pins to top)"}
                className={`perk-admin-btn${isFeatured ? " active-star" : ""}`}
              >
                {isTogglingFeatured ? "…" : isFeatured ? "★" : "☆"}
              </button>
            )}
            {onToggleHide && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleHide(product.id, !isHidden);
                }}
                disabled={isTogglingHide}
                title={isHidden ? "Show this product to ambassadors" : "Hide this product from ambassadors"}
                className={`perk-admin-btn${isHidden ? " active-hide" : ""}`}
              >
                {isTogglingHide ? "…" : isHidden ? "👁" : "🚫"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="perk-brand serif">{product.name}</div>
      {product.shortDescription && (
        <div className="perk-cat mono">{product.shortDescription}</div>
      )}

      {product.offer && (
        <p className="perk-deal">
          <strong>{product.offer}</strong>
          {product.offer2 ? <>{" — "}{product.offer2}</> : null}
        </p>
      )}

      {!product.offer && product.offer2 && <p className="perk-deal">{product.offer2}</p>}

      {(product.estimateSavingText || product.estimatedSavingMax) && (
        <div className="perk-savings mono">
          {product.estimateSavingText
            ? product.estimateSavingText
            : `Save up to $${product.estimatedSavingMax?.toLocaleString()}`}
        </div>
      )}

      <div className="perk-foot">
        <span className="perk-tier mono" style={{ color: meta.tone }}>
          {meta.label}
        </span>
        <button
          type="button"
          className="perk-action mono"
          onClick={(e) => {
            e.preventDefault();
            onClaimClick?.(product);
          }}
        >
          Claim →
        </button>
      </div>
    </div>
  );
}

// ── Locked teaser card (blurred preview for gated deal types) ─────────────────
function LockedTeaserCard({ dealType, requiredLevel }: { dealType: DealType; requiredLevel: number }) {
  const meta = DEAL_TYPE_META[dealType];
  return (
    <div className="perk-card locked">
      <span className="perk-ribbon locked-ribbon">▲ L{requiredLevel}+</span>
      <div className="perk-card-top">
        <div className="perk-logo perk-logo-locked">⊘</div>
      </div>
      <div className="perk-brand serif">{meta.label} Locked</div>
      <div className="perk-cat mono">Tier-gated · Level {requiredLevel}+</div>
      <p className="perk-deal">
        Reach <strong>Level {requiredLevel}</strong> to unlock {meta.description.toLowerCase()}
      </p>
      <div className="perk-foot">
        <span className="perk-tier mono" style={{ color: "var(--ink-mute)" }}>
          {meta.label}
        </span>
        <span className="perk-action locked-action mono">Unlock</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface PerksTabProps {
  tier?: string;
  level?: number;
  isAdmin?: boolean;
}

export function PerksTab({ tier: _tier, level = 2, isAdmin = false }: PerksTabProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeDealFilter, setActiveDealFilter] = useState<"all" | DealType>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [togglingHideId, setTogglingHideId] = useState<string | null>(null);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const [comingSoonProduct, setComingSoonProduct] = useState<NNProduct | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as unknown as { __nnSearchTimer?: ReturnType<typeof setTimeout> }).__nnSearchTimer);
    (window as unknown as { __nnSearchTimer?: ReturnType<typeof setTimeout> }).__nnSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.perks.listProducts.useQuery(
    {
      search: debouncedSearch || undefined,
      category: activeCategory === "All" ? undefined : activeCategory,
      page,
      pageSize: 24,
    },
    { staleTime: 10 * 60 * 1000 }
  );

  const toggleHideMutation = trpc.perks.toggleProductVisibility.useMutation({
    onSuccess: () => {
      utils.perks.listProducts.invalidate();
      setTogglingHideId(null);
    },
    onError: () => {
      setTogglingHideId(null);
    },
  });

  const toggleFeaturedMutation = trpc.perks.toggleProductFeatured.useMutation({
    onSuccess: () => {
      utils.perks.listProducts.invalidate();
      setTogglingFeaturedId(null);
      setPage(1);
    },
    onError: () => {
      setTogglingFeaturedId(null);
    },
  });

  const handleToggleHide = (productId: string, hide: boolean) => {
    setTogglingHideId(productId);
    toggleHideMutation.mutate({ productId, hide });
  };

  const handleToggleFeatured = (productId: string, featured: boolean) => {
    setTogglingFeaturedId(productId);
    toggleFeaturedMutation.mutate({ productId, featured });
  };

  const { unlockedTypes, gateMessage } = getTierAccess(level);

  // Category list — always fetch from "All" to get the full list
  const { data: allData } = trpc.perks.listProducts.useQuery(
    { pageSize: 1 },
    { staleTime: 30 * 60 * 1000 }
  );
  const categories = useMemo(() => {
    if (!allData?.categories) return [];
    return ["All", ...allData.categories];
  }, [allData]);

  // Classify products by offer text
  const classifiedProducts = useMemo(() => {
    const raw = (data?.products ?? []) as NNProduct[];
    return raw.map((p) => ({
      ...p,
      dealType: classifyDeal(p.offer, p.offer2, p.estimateSavingText),
    }));
  }, [data]);

  // Filter by deal type chip
  const filteredProducts = useMemo(() => {
    if (activeDealFilter === "all") return classifiedProducts;
    return classifiedProducts.filter((p) => p.dealType === activeDealFilter);
  }, [classifiedProducts, activeDealFilter]);

  // Count per deal type (for chip badges)
  const countByType = useMemo(() => {
    const counts: Record<DealType, number> = {
      free_credits: 0,
      cashback: 0,
      discount: 0,
      other: 0,
    };
    for (const p of classifiedProducts) counts[p.dealType] += 1;
    return counts;
  }, [classifiedProducts]);

  const total = data?.total ?? 0;
  const featuredCount = isAdmin ? data?.featuredIds?.length ?? 0 : 0;

  // Admin: catalog status + rebuild
  const { data: catalogStatusData, refetch: refetchCatalogStatus } = trpc.perks.catalogStatus.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 10_000 }
  );
  const rebuildCatalogMutation = trpc.perks.rebuildCatalog.useMutation({
    onSuccess: () => {
      setTimeout(() => refetchCatalogStatus(), 3000);
    },
  });
  const lockedTypes = DEAL_TYPE_ORDER.filter((t) => !unlockedTypes.includes(t));

  const styles = (
    <style>{`
      .perks-hero { padding: 48px 0 28px; position: relative; }
      .perks-hero h1 { margin: 0 0 18px; }
      .perks-hero .lead { max-width: 680px; margin-bottom: 0; }

      .deal-strip {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
        margin-top: 36px;
      }
      @media (max-width: 860px) { .deal-strip { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 540px) { .deal-strip { grid-template-columns: 1fr; } }
      .deal-pill {
        background: var(--paper); border: 1px solid var(--line);
        border-radius: 10px; padding: 18px 20px;
      }
      .deal-pill.you { background: rgba(0,200,134,0.06); border-color: rgba(0,200,134,0.4); }
      .deal-pill.locked { opacity: 0.55; }
      .deal-pill .dname {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); letter-spacing: 0.12em; text-transform: uppercase;
        font-weight: 700; margin-bottom: 8px;
      }
      .deal-pill.you .dname { color: var(--green); }
      .deal-pill .dcount {
        font-family: 'Fraunces', serif; font-size: 32px;
        font-weight: 500; letter-spacing: -0.02em; line-height: 1;
      }
      .deal-pill .dcount small {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); letter-spacing: 0.06em;
        text-transform: uppercase; font-weight: 600; margin-left: 6px;
      }
      .deal-pill .ddesc { font-size: 12px; color: var(--ink-soft); line-height: 1.5; margin-top: 8px; }

      .cat-bar { display: flex; gap: 6px; flex-wrap: wrap; margin: 36px 0 16px; }
      .cat-pill {
        padding: 8px 16px; border: 1px solid var(--line);
        border-radius: 999px; background: var(--paper); color: var(--ink-soft);
        font-family: 'Inter', sans-serif; font-size: 13px;
        cursor: pointer; transition: all .12s;
      }
      .cat-pill:hover { color: var(--ink); border-color: var(--ink-soft); }
      .cat-pill.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .cat-pill.locked { opacity: 0.4; cursor: not-allowed; }
      .cat-pill.locked:hover { color: var(--ink-soft); border-color: var(--line); }
      .cat-pill .count { opacity: 0.55; margin-left: 6px; font-size: 12px; }

      .deal-bar { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 24px; }

      .perks-toolbar {
        display: flex; justify-content: space-between; align-items: center; gap: 16px;
        flex-wrap: wrap; margin-bottom: 18px;
      }
      .perks-search {
        position: relative; max-width: 320px; flex: 1 1 220px; min-width: 200px;
      }
      .perks-search input {
        width: 100%;
        background: var(--paper);
        border: 1px solid var(--line);
        color: var(--ink);
        padding: 9px 14px 9px 36px;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
        border-radius: 999px;
        font-family: 'Inter', sans-serif;
      }
      .perks-search input::placeholder { color: var(--ink-mute); }
      .perks-search input:focus { border-color: var(--ink-soft); }
      .perks-search .icon {
        position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
        color: var(--ink-mute); font-size: 13px; pointer-events: none;
      }
      .admin-badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .admin-badge {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px; font-weight: 700;
        letter-spacing: 0.12em; text-transform: uppercase;
        padding: 4px 10px; border-radius: 999px;
        border: 1px solid var(--line); background: var(--paper-2);
        color: var(--ink-soft);
      }
      .admin-badge.warn { color: #b58e1d; border-color: rgba(181,142,29,0.35); background: rgba(181,142,29,0.07); }
      .admin-badge.feat { color: var(--green); border-color: rgba(0,200,134,0.35); background: rgba(0,200,134,0.07); }

      .perks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      @media (max-width: 980px) { .perks-grid { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 600px) { .perks-grid { grid-template-columns: 1fr; } }

      .perk-card {
        background: var(--paper); border: 1px solid var(--line);
        border-radius: 12px; padding: 24px;
        display: flex; flex-direction: column;
        position: relative;
        transition: transform .15s, border-color .15s;
        min-height: 240px;
      }
      .perk-card.unlocked:hover { transform: translateY(-2px); border-color: var(--ink); }
      .perk-card.locked { opacity: 0.6; }
      .perk-card.hidden-card { opacity: 0.55; }
      .perk-card.featured { border-color: rgba(0,200,134,0.45); background: rgba(0,200,134,0.04); }

      .perk-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }

      .perk-logo {
        width: 48px; height: 48px;
        background: var(--paper-2);
        border-radius: 12px;
        display: grid; place-items: center;
        font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600;
        border: 1px solid var(--line);
        overflow: hidden;
        flex-shrink: 0;
      }
      .perk-card.unlocked .perk-logo {
        background: var(--green-brand);
        border: none;
        color: var(--ink);
      }
      .perk-card.featured .perk-logo { background: var(--green-brand); border: none; }
      .perk-logo img {
        width: 36px; height: 36px; object-fit: contain;
        background: transparent;
      }
      .perk-card.unlocked .perk-logo img { background: var(--paper); border-radius: 8px; padding: 2px; }
      .perk-logo-fallback { background: var(--paper-2) !important; color: var(--ink); border: 1px solid var(--line); }
      .perk-logo-locked { background: var(--paper-2); color: var(--ink-mute); font-size: 22px; }

      .perk-admin-controls { display: flex; gap: 6px; flex-shrink: 0; }
      .perk-admin-btn {
        background: var(--paper-2);
        border: 1px solid var(--line);
        color: var(--ink-soft);
        padding: 4px 10px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.12s;
        border-radius: 6px;
        line-height: 1;
      }
      .perk-admin-btn:hover { color: var(--ink); border-color: var(--ink-soft); }
      .perk-admin-btn.active-star {
        background: rgba(0,200,134,0.10);
        border-color: rgba(0,200,134,0.45);
        color: var(--green);
      }
      .perk-admin-btn.active-hide {
        background: rgba(232,138,108,0.12);
        border-color: rgba(232,138,108,0.5);
        color: var(--rose);
      }
      .perk-admin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .perk-brand {
        font-family: 'Fraunces', serif; font-size: 22px;
        font-weight: 500; letter-spacing: -0.01em; margin-bottom: 4px;
        line-height: 1.15;
      }
      .perk-cat {
        font-family: 'JetBrains Mono', monospace; font-size: 10px;
        color: var(--ink-mute); letter-spacing: 0.08em;
        margin-bottom: 14px;
        line-height: 1.45;
      }
      .perk-deal { font-size: 14px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 14px; flex: 1; }
      .perk-deal strong { color: var(--ink); font-weight: 600; }
      .perk-savings {
        font-size: 11px; font-weight: 600;
        color: var(--green); letter-spacing: 0.06em; text-transform: uppercase;
        margin-bottom: 14px;
      }
      .perk-foot {
        display: flex; justify-content: space-between; align-items: center;
        padding-top: 14px; border-top: 1px solid var(--line);
        margin-top: auto;
      }
      .perk-tier {
        font-family: 'JetBrains Mono', monospace; font-size: 10px;
        letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700;
      }
      .perk-action {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
        text-decoration: none; padding: 6px 14px; border-radius: 999px;
        background: var(--ink); color: var(--paper);
        border: none; cursor: pointer;
        transition: background 0.12s;
      }
      .perk-action:hover { background: #000; }
      .perk-action.locked-action {
        background: var(--paper-2); color: var(--ink-mute); cursor: not-allowed;
      }
      .perk-ribbon {
        position: absolute; top: 12px; right: 12px;
        padding: 4px 10px; border-radius: 999px;
        font-family: 'JetBrains Mono', monospace; font-size: 9px;
        letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
        background: var(--green-brand); color: var(--ink);
      }
      .perk-ribbon.locked-ribbon {
        background: var(--paper-2); color: var(--ink-mute);
        border: 1px solid var(--line);
      }
      .perk-card.featured .perk-ribbon { background: var(--green); color: var(--paper); }
      .perk-hidden-badge {
        position: absolute; top: 12px; left: 12px;
        background: rgba(232,138,108,0.12); color: var(--rose);
        border: 1px solid rgba(232,138,108,0.4);
        padding: 3px 9px; border-radius: 999px;
        font-family: 'JetBrains Mono', monospace; font-size: 9px;
        letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700;
      }

      .perk-skel {
        background: var(--paper); border: 1px solid var(--line);
        border-radius: 12px; height: 240px;
        animation: paper-pulse 1.5s ease-in-out infinite;
      }
      @keyframes paper-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 0.85; }
      }

      .vault-locked {
        background: var(--paper); border: 1px dashed var(--line);
        border-radius: 12px; padding: 60px 32px; text-align: center;
        display: flex; flex-direction: column; align-items: center; gap: 14px;
      }
      .vault-locked .icon {
        width: 56px; height: 56px; border-radius: 50%;
        border: 1px solid var(--line); background: var(--paper-2);
        display: grid; place-items: center;
        font-size: 24px; color: var(--ink-mute);
      }

      .empty-state {
        background: var(--paper); border: 1px solid var(--line);
        border-radius: 12px; padding: 40px 24px; text-align: center;
        color: var(--ink-mute); font-size: 14px;
      }

      .error-block {
        background: rgba(232,138,108,0.08);
        border: 1px solid rgba(232,138,108,0.4);
        color: var(--rose);
        padding: 14px 18px; border-radius: 10px;
        font-size: 13px;
      }

      .pagination {
        display: flex; align-items: center; gap: 14px;
        margin-top: 32px; justify-content: center;
      }
      .page-btn {
        background: var(--paper); border: 1px solid var(--line);
        color: var(--ink-soft);
        padding: 7px 18px; border-radius: 999px;
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.1em;
        cursor: pointer; transition: all 0.12s;
      }
      .page-btn:hover:not(:disabled) { color: var(--ink); border-color: var(--ink-soft); }
      .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .page-label {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); font-variant-numeric: tabular-nums;
      }

      .locked-section { margin-top: 56px; }
      .locked-section-title {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        font-weight: 700; color: var(--ink-mute);
        text-transform: uppercase; letter-spacing: 0.15em;
        margin-bottom: 16px;
      }
      .locked-grid-wrap { position: relative; }
      .locked-grid-wrap .perks-grid { filter: blur(2.5px); pointer-events: none; user-select: none; }
      .locked-overlay {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 12px;
        background: linear-gradient(180deg, rgba(244,239,230,0.25) 0%, rgba(244,239,230,0.85) 60%);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
      }
      .locked-overlay .lock-icon {
        width: 44px; height: 44px; border-radius: 50%;
        border: 1px solid var(--line); background: var(--paper);
        display: grid; place-items: center;
        font-size: 18px; color: var(--ink-mute);
      }
      .locked-overlay .lock-title {
        font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500;
        letter-spacing: -0.01em; color: var(--ink);
      }
      .locked-overlay .lock-desc {
        font-size: 13px; color: var(--ink-soft); max-width: 360px; line-height: 1.55;
      }

      .perks-footer {
        margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line);
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); letter-spacing: 0.04em; line-height: 1.6;
      }
    `}</style>
  );

  // Full gate: level 0 — show locked vault
  if (gateMessage) {
    return (
      <div>
        {styles}
        <section className="paper-noise perks-hero">
          <div className="paper-pill" style={{ marginBottom: 22 }}>
            <span className="paper-dot" /> Perks Vault · <strong style={{ color: "var(--ink-mute)", marginLeft: 4 }}>Locked</strong>
          </div>
          <h1 className="h-display serif">
            Perks <em>Vault.</em>
          </h1>
          <p className="lead">
            Software deals and creator tools, branded Ambassador Perks, unlocked deeper as your tier climbs. Active tier
            required. Steps back if contribution drops.
          </p>
        </section>

        <div className="vault-locked" style={{ marginBottom: 32 }}>
          <div className="icon">⊘</div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}>
            Vault Locked
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 420, margin: 0 }}>
            {gateMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {styles}

      {/* Hero */}
      <section className="paper-noise perks-hero">
        <div className="paper-pill" style={{ marginBottom: 22 }}>
          <span className="paper-dot" /> Your tier ·{" "}
          <strong style={{ color: "var(--green)", marginLeft: 4 }}>Active</strong>
        </div>
        <h1 className="h-display serif">
          Perks <em>Vault.</em>
        </h1>
        <p className="lead">
          Software deals and creator tools, branded Ambassador Perks, unlocked deeper as your tier climbs. Active tier
          required. Steps back if contribution drops.
        </p>

        {/* Deal-type strip — analogous to PerksVault.html's tier-strip */}
        <div className="deal-strip">
          {DEAL_TYPE_ORDER.map((t) => {
            const meta = DEAL_TYPE_META[t];
            const isUnlocked = unlockedTypes.includes(t);
            const isCurrentlyHighlighted = level === 1 ? t === "free_credits" : isUnlocked && t === "free_credits";
            const cls = `deal-pill${isCurrentlyHighlighted ? " you" : ""}${!isUnlocked ? " locked" : ""}`;
            return (
              <div key={t} className={cls}>
                <div className="dname">
                  {isCurrentlyHighlighted ? "★ " : ""}
                  {meta.label}
                  {!isUnlocked ? " · locked" : ""}
                </div>
                <div className="dcount">
                  {countByType[t]}
                  <small>deals</small>
                </div>
                <div className="ddesc">{meta.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toolbar: search + admin badges */}
      <section style={{ padding: "12px 0 4px" }}>
        <div className="perks-toolbar">
          <div className="perks-search">
            <span className="icon">⌕</span>
            <input
              type="text"
              placeholder="Search deals…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          {isAdmin && (
            <div className="admin-badges">
              <span className="admin-badge warn">Admin · ★ Feature · 🚫/👁 Hide</span>
              {featuredCount > 0 && <span className="admin-badge feat">{featuredCount} Featured</span>}
              {total > 0 && <span className="admin-badge">{total} Total</span>}
              {catalogStatusData && (
                <span className={`admin-badge${catalogStatusData.ready ? " feat" : " warn"}`}>
                  Catalog: {catalogStatusData.ready ? `${catalogStatusData.size} products ✓` : "not ready"}
                </span>
              )}
              <button
                type="button"
                className="perk-admin-btn"
                style={{ padding: "3px 10px", fontSize: "11px", borderRadius: 6, background: "var(--ink)", color: "var(--paper)", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                onClick={() => rebuildCatalogMutation.mutate()}
                disabled={rebuildCatalogMutation.isPending}
                title="Force rebuild the full NachoNacho catalog from API"
              >
                {rebuildCatalogMutation.isPending ? "Rebuilding…" : "↺ Rebuild Catalog"}
              </button>
            </div>
          )}
          {!isAdmin && total > 0 && (
            <div className="admin-badges">
              <span className="admin-badge">{total} Deals</span>
            </div>
          )}
        </div>

        {/* Deal-type filter chips (with locked state) */}
        <div className="deal-bar">
          <button
            type="button"
            className={`cat-pill${activeDealFilter === "all" ? " active" : ""}`}
            onClick={() => {
              setActiveDealFilter("all");
              setPage(1);
            }}
          >
            All deals
            {classifiedProducts.length > 0 && <span className="count">{classifiedProducts.length}</span>}
          </button>
          {DEAL_TYPE_ORDER.map((t) => {
            const meta = DEAL_TYPE_META[t];
            const count = countByType[t];
            const isActive = activeDealFilter === t;
            const isLocked = !unlockedTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                disabled={isLocked}
                className={`cat-pill${isActive ? " active" : ""}${isLocked ? " locked" : ""}`}
                onClick={() => {
                  if (isLocked) return;
                  setActiveDealFilter(t);
                  setPage(1);
                }}
                title={isLocked ? `Reach Level 2 to unlock ${meta.label}` : undefined}
              >
                {isLocked ? "⊘ " : ""}
                {meta.label}
                {!isLocked && count > 0 && <span className="count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Industry category chips (from API) */}
        {categories.length > 0 && (
          <div className="cat-bar">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`cat-pill${isActive ? " active" : ""}`}
                  onClick={() => {
                    setActiveCategory(cat);
                    setPage(1);
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Loading */}
      {isLoading && (
        <section style={{ padding: "12px 0 60px" }}>
          <div className="perks-grid">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="perk-skel" />
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {!isLoading && error && (
        <section style={{ padding: "12px 0 60px" }}>
          <div className="error-block">Failed to load deals. Please try again.</div>
        </section>
      )}

      {/* Product grid */}
      {!isLoading && !error && (
        <section style={{ padding: "12px 0 60px" }}>
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              No deals found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}.
            </div>
          ) : (
            <div className="perks-grid">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  dealType={p.dealType}
                  isAdmin={isAdmin}
                  onToggleHide={isAdmin ? handleToggleHide : undefined}
                  onToggleFeatured={isAdmin ? handleToggleFeatured : undefined}
                  onClaimClick={setComingSoonProduct}
                  isTogglingHideId={togglingHideId}
                  isTogglingFeaturedId={togglingFeaturedId}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 24 && (
            <div className="pagination">
              <button
                type="button"
                className="page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="page-label">
                Page {page} · {total} total
              </span>
              <button
                type="button"
                className="page-btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={filteredProducts.length < 24}
              >
                Next →
              </button>
            </div>
          )}

          {/* Locked sections — blurred preview with upgrade CTA */}
          {activeDealFilter === "all" && lockedTypes.length > 0 && (
            <div className="locked-section">
              <div className="locked-section-title">· More unlocks as you climb tiers</div>
              <div className="locked-grid-wrap">
                <div className="perks-grid" aria-hidden>
                  {lockedTypes.flatMap((t) =>
                    Array.from({ length: 3 }).map((_, idx) => (
                      <LockedTeaserCard key={`${t}-${idx}`} dealType={t} requiredLevel={2} />
                    ))
                  )}
                </div>
                <div className="locked-overlay">
                  <div className="lock-icon">⊘</div>
                  <div className="lock-title">
                    {lockedTypes.length === 1
                      ? `${DEAL_TYPE_META[lockedTypes[0]!].label} locked`
                      : `${lockedTypes.length} deal types locked`}
                  </div>
                  <div className="lock-desc">
                    Reach <strong style={{ color: "var(--ink)" }}>Level 2</strong> (Ambassador) to unlock
                    cashback, discounts, and partner bonuses. Earn XP through contribution to climb the ladder.
                  </div>
                  <span className="paper-sticker" style={{ marginTop: 4 }}>
                    Level 2 required
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <div className="perks-footer">
        Deals curated exclusively for ambassadors. Redemption details confirmed with each partner before going
        live.
      </div>

      {/* Coming Soon Modal */}
      <ComingSoonModal product={comingSoonProduct} onClose={() => setComingSoonProduct(null)} />
    </div>
  );
}

export default PerksTab;
