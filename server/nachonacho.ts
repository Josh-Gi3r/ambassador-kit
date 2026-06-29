import { ENV } from "./_core/env";
import { getDb } from "./db";
import { perksProductCache } from "../drizzle/schema";

const NN_API = "https://public-api.nachonacho.com";

// ── Auth token cache ──────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${NN_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: ENV.nachoNachoApiKey }),
  });
  if (!res.ok) throw new Error(`NachoNacho auth failed: ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };
  cachedToken = access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return access_token;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface NNProduct {
  id: string;
  name: string;
  logo: string;
  shortDescription: string;
  sellerLink: string;
  offer: string;
  offer2?: string;
  estimateSavingText?: string;
  estimatedSavingMax?: number;
  pricing?: string;
  signupLink?: string;
  relationshipType: string;
  category: string;
  isNonCashback: boolean;
}

interface NNRawProduct {
  id: string;
  name: string;
  logo: string;
  shortDescription: string;
  sellerLink: string;
  offer: string;
  offer2?: string;
  estimateSavingText?: string;
  estimatedSavingMax?: number;
  pricing?: string;
  signupLink?: string;
  relationshipType: string;
}

interface NNProductsResponse {
  page: number;
  take: number;
  total: number;
  products: NNRawProduct[];
}

// ── Industry category classification ─────────────────────────────────────────
const CATEGORY_RULES: Array<{ name: string; keywords: string[] }> = [
  {
    name: "AI & Automation",
    keywords: [
      "ai", "artificial intelligence", "machine learning", "automation", "chatbot",
      "gpt", "llm", "generative", "viktor", "clay", "jasper", "copy.ai", "writesonic",
      "zapier", "make.com", "n8n", "bardeen", "midjourney", "openai", "anthropic",
      "cohere", "hugging", "replicate", "runway", "synthesia", "heygen", "descript",
      "otter", "fireflies", "notion ai", "perplexity", "phind", "cursor", "codeium",
      "tabnine", "github copilot", "replit", "v0", "lovable", "bolt", "windsurf",
    ],
  },
  {
    name: "Banking & Finance",
    keywords: [
      "bank", "finance", "fintech", "payment", "payroll", "accounting", "invoice",
      "billing", "expense", "ramp", "brex", "mercury", "stripe", "quickbooks", "xero",
      "freshbooks", "wave", "gusto", "rippling", "deel", "remote", "pilot", "bench",
      "taxjar", "avalara", "1-800accountant", "accountant", "bookkeeping", "tax",
      "treasury", "bluevine", "relay", "found", "lili", "novo", "arc", "betterment",
      "carta", "captable", "equity", "401k", "paycheck", "payslip", "reimbursement",
    ],
  },
  {
    name: "Marketing",
    keywords: [
      "marketing", "seo", "email marketing", "social media", "advertising", "campaign",
      "mailchimp", "klaviyo", "activecampaign", "sendinblue", "brevo", "constant contact",
      "semrush", "ahrefs", "moz", "buffer", "hootsuite", "sprout", "later", "canva",
      "figma", "beehiiv", "substack", "convertkit", "drip", "omnisend", "postscript",
      "attentive", "privy", "yotpo", "stamped", "loox", "okendo", "reviews",
      "influencer", "affiliate", "referral", "viral", "growth", "acquisition",
    ],
  },
  {
    name: "Sales & CRM",
    keywords: [
      "crm", "sales", "lead", "pipeline", "salesforce", "pipedrive", "close",
      "outreach", "salesloft", "apollo", "zoominfo", "clearbit", "hunter",
      "lemlist", "instantly", "smartlead", "woodpecker", "reply.io", "mixmax",
      "yesware", "gong", "chorus", "clari", "forecast", "quota", "commission",
      "proposal", "quote", "pandadoc", "docusign", "hellosign", "contract",
    ],
  },
  {
    name: "Dev Tools",
    keywords: [
      "developer", "development", "code", "api", "github", "gitlab", "aws",
      "amazon web services", "google cloud", "azure", "heroku", "vercel", "netlify",
      "digitalocean", "linode", "datadog", "sentry", "postman", "mongodb", "supabase",
      "firebase", "twilio", "sendgrid", "segment", "algolia", "elastic", "redis",
      "docker", "kubernetes", "terraform", "pulumi", "cloudflare", "fastly",
      "cdn", "hosting", "server", "database", "postgres", "mysql", "sqlite",
      "testing", "ci/cd", "devops", "infrastructure", "cloud", "compute", "storage",
    ],
  },
  {
    name: "HR & Productivity",
    keywords: [
      "hr", "human resources", "recruitment", "hiring", "onboarding", "employee",
      "workspace", "productivity", "project management", "task", "asana", "monday",
      "notion", "clickup", "trello", "jira", "linear", "airtable", "coda",
      "confluence", "slack", "zoom", "loom", "calendly", "cal.com", "doodle",
      "lattice", "culture amp", "leapsome", "15five", "bamboohr", "workday",
      "greenhouse", "lever", "ashby", "workable", "teamtailor", "remote work",
      "time tracking", "timesheet", "attendance", "performance", "okr", "goal",
    ],
  },
  {
    name: "Design & Creative",
    keywords: [
      "design", "creative", "video", "photo", "image", "graphic", "adobe",
      "sketch", "invision", "miro", "mural", "whimsical", "framer", "webflow",
      "wix", "squarespace", "wordpress", "elementor", "divi", "theme",
      "stock photo", "unsplash", "shutterstock", "getty", "envato", "template",
      "presentation", "pitch deck", "slides", "beautiful.ai", "pitch", "prezi",
    ],
  },
  {
    name: "Security & Compliance",
    keywords: [
      "security", "compliance", "privacy", "vpn", "password", "authentication",
      "2fa", "mfa", "soc 2", "gdpr", "audit", "1password", "lastpass", "bitwarden",
      "okta", "auth0", "vanta", "drata", "secureframe", "tugboat", "anecdotes",
      "penetration", "pentest", "vulnerability", "firewall", "endpoint", "antivirus",
      "siem", "zero trust", "identity", "access management", "iam", "sso",
    ],
  },
  {
    name: "E-commerce & Retail",
    keywords: [
      "ecommerce", "e-commerce", "shopify", "woocommerce", "store", "retail",
      "inventory", "shipping", "fulfillment", "shipbob", "shipstation", "gorgias",
      "rechargepayments", "recharge", "bold", "loyalty", "rewards", "points",
      "subscription box", "dropship", "print on demand", "marketplace", "amazon fba",
    ],
  },
  {
    name: "Analytics & Data",
    keywords: [
      "analytics", "data", "reporting", "dashboard", "business intelligence", "bi",
      "mixpanel", "amplitude", "heap", "hotjar", "fullstory", "tableau", "looker",
      "metabase", "chartmogul", "baremetrics", "profitwell", "pendo", "appcues",
      "intercom product", "user research", "survey", "typeform", "google analytics",
      "segment", "rudderstack", "snowflake", "databricks", "dbt", "fivetran", "airbyte",
    ],
  },
  {
    name: "Communication",
    keywords: [
      "communication", "phone", "call", "sms", "chat", "messaging", "voip",
      "callhippo", "ringcentral", "dialpad", "aircall", "openphone", "grasshopper",
      "intercom", "drift", "crisp", "freshdesk", "zendesk", "helpscout", "front",
      "missive", "superhuman", "email", "inbox", "support", "customer service",
      "live chat", "helpdesk", "ticketing", "knowledge base",
    ],
  },
  {
    name: "Legal",
    keywords: [
      "legal", "lawyer", "attorney", "trademark", "patent", "incorporate",
      "llc", "corporation", "clerky", "stripe atlas", "firstbase", "doola",
      "northwest", "registered agent", "contract template", "nda", "terms of service",
    ],
  },
];

function classifyProduct(name: string, description: string): string {
  const text = (name + " " + (description || "")).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.name;
    }
  }
  return "Other";
}

function isNonCashback(offer: string): boolean {
  const o = (offer || "").trim();
  // Cashback patterns — these are NOT freebies, push to end
  // 1. Pure % cashback: "15% CASHBACK", "20% cash back"
  if (/^\d+(\.\d+)?%\s*(cashback|cash\s*back)/i.test(o)) return false;
  // 2. Dollar cashback: "$300 CASHBACK", "$50 Cashback"
  if (/^\$\d[\d,]*\s*(cashback|cash\s*back)/i.test(o)) return false;
  // 3. Any offer that ends with cashback and has no other value keyword
  if (/cashback|cash\s*back/i.test(o) && !/credit|bonus|free|discount|\d+k?\s*in\s/i.test(o)) return false;
  // Non-cashback = has a concrete credit/bonus/free/discount offer
  if (/credit|bonus|sign.?up|free|\$\d+|\d+k?\s*in\s|month.?free|year.?free|discount/i.test(o)) return true;
  return false;
}

// Preferred category display order — freelancer-first
const CATEGORY_ORDER: string[] = [
  "AI & Automation",
  "Banking & Finance",
  "Design & Creative",
  "Marketing",
  "Sales & CRM",
  "HR & Productivity",
  "Dev Tools",
  "Analytics & Data",
  "Communication",
  "Security & Compliance",
  "E-commerce & Retail",
  "Legal",
  "Other",
];

function categoryRank(cat: string): number {
  const idx = CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? CATEGORY_ORDER.length - 1 : idx;
}

function classifyAndSort(raw: NNRawProduct[]): NNProduct[] {
  const classified: NNProduct[] = raw.map((p) => ({
    ...p,
    category: classifyProduct(p.name, p.shortDescription),
    isNonCashback: isNonCashback(p.offer),
  }));
  // Primary: non-cashback (credits/bonuses/discounts) first, cashback last
  // Secondary: category order (AI first, Other last)
  classified.sort((a, b) => {
    if (a.isNonCashback !== b.isNonCashback) {
      return a.isNonCashback ? -1 : 1;
    }
    return categoryRank(a.category) - categoryRank(b.category);
  });
  return classified;
}

function buildCategories(catalog: NNProduct[]): string[] {
  const catCounts: Record<string, number> = {};
  for (const p of catalog) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  // Return categories in preferred order, only those that have products
  return CATEGORY_ORDER.filter((cat) => catCounts[cat] > 0);
}

// ── Full catalog cache (all pages, built in background) ───────────────────────
let fullCatalog: NNProduct[] | null = null;
let fullCatalogExpiry = 0;
let buildingCatalog = false;
const CATALOG_TTL = 30 * 60 * 1000; // 30 minutes

async function saveCatalogToDb(catalog: NNProduct[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const now = Date.now();
    const expiresAt = now + CATALOG_TTL;
    const data = JSON.stringify(catalog);
    // Keep only the latest row
    await db.delete(perksProductCache);
    await db.insert(perksProductCache).values({ cachedAt: now, expiresAt, data });
    console.log(`[NachoNacho] Catalog persisted to DB (${catalog.length} products)`);
  } catch (err) {
    console.warn("[NachoNacho] Failed to persist catalog to DB:", (err as Error).message);
  }
}

async function loadCatalogFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(perksProductCache).limit(1);
    if (rows.length === 0) return;
    const row = rows[0];
    if (Date.now() > row.expiresAt) {
      console.log("[NachoNacho] DB catalog expired, will rebuild");
      return;
    }
    const catalog = JSON.parse(row.data) as NNProduct[];
    fullCatalog = catalog;
    fullCatalogExpiry = row.expiresAt;
    const nc = catalog.filter(p => p.isNonCashback).length;
    console.log(`[NachoNacho] Catalog loaded from DB: ${catalog.length} products (${nc} credits/discounts)`);
  } catch (err) {
    console.warn("[NachoNacho] Failed to load catalog from DB:", (err as Error).message);
  }
}

export async function buildFullCatalogInBackground(): Promise<void> {
  if (buildingCatalog) return;
  buildingCatalog = true;
  try {
    const token = await getToken();
    let all: NNRawProduct[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${NN_API}/products?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) break;
      const data = (await res.json()) as NNProductsResponse;
      if (!data.products || data.products.length === 0) break;
      all = all.concat(data.products);
      if (all.length >= data.total) break;
      page++;
      await new Promise((r) => setTimeout(r, 80));
    }
    fullCatalog = classifyAndSort(all);
    fullCatalogExpiry = Date.now() + CATALOG_TTL;
    const nc = fullCatalog.filter(p => p.isNonCashback).length;
    const cb = fullCatalog.filter(p => !p.isNonCashback).length;
    console.log(`[NachoNacho] Full catalog cached: ${fullCatalog.length} products (${nc} credits/discounts, ${cb} cashback)`);
    // Persist to DB so it survives server restarts
    await saveCatalogToDb(fullCatalog);
  } catch (err) {
    console.warn("[NachoNacho] Background catalog build failed:", (err as Error).message);
  } finally {
    buildingCatalog = false;
  }
}

// On startup: try to load from DB first, then kick off a background refresh
(async () => {
  await loadCatalogFromDb();
  // Always kick off a background build to refresh the catalog
  buildFullCatalogInBackground();
})();

// Allow callers to check if catalog is ready
export function getCatalogStatus(): { ready: boolean; size: number; expiresAt: number } {
  return {
    ready: fullCatalog !== null && Date.now() < fullCatalogExpiry,
    size: fullCatalog?.length ?? 0,
    expiresAt: fullCatalogExpiry,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function fetchNachoNachoProducts(opts: {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  featuredIds?: Set<string>;
  hiddenIds?: Set<string>;
  isAdmin?: boolean;
}): Promise<{ products: NNProduct[]; total: number; categories: string[]; isPartial?: boolean }> {
  const { search, category, page = 1, pageSize = 24, featuredIds, hiddenIds, isAdmin } = opts;

  // If full catalog is ready, use it for accurate results
  if (fullCatalog && Date.now() < fullCatalogExpiry) {
    let filtered = fullCatalog;
    // Non-admins: filter out hidden products
    if (!isAdmin && hiddenIds && hiddenIds.size > 0) {
      filtered = filtered.filter((p) => !hiddenIds.has(p.id));
    }
    if (category && category !== "All") {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription || "").toLowerCase().includes(q) ||
          (p.offer || "").toLowerCase().includes(q)
      );
    }
    // Pin featured products to the absolute front (alphabetical), rest follows
    if (featuredIds && featuredIds.size > 0) {
      const featured = filtered
        .filter((p) => featuredIds.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      const rest = filtered.filter((p) => !featuredIds.has(p.id));
      filtered = [...featured, ...rest];
    }
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return {
      products: slice,
      total: filtered.length,
      categories: buildCategories(fullCatalog),
    };
  }

  // Catalog still building — return first page immediately (fast ~1s)
  // Background build is already running
  const token = await getToken();
  const res = await fetch(`${NN_API}/products?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`NachoNacho products fetch failed: ${res.status}`);
  const data = (await res.json()) as NNProductsResponse;
  const classified = classifyAndSort(data.products || []);

  let filtered = classified;
  // Non-admins: filter out hidden products (same as full catalog path)
  if (!isAdmin && hiddenIds && hiddenIds.size > 0) {
    filtered = filtered.filter((p) => !hiddenIds.has(p.id));
  }
  if (category && category !== "All") {
    filtered = filtered.filter((p) => p.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.shortDescription || "").toLowerCase().includes(q) ||
        (p.offer || "").toLowerCase().includes(q)
    );
  }
  // Pin featured products to the front even in partial mode
  if (featuredIds && featuredIds.size > 0) {
    const featured = filtered
      .filter((p) => featuredIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const rest = filtered.filter((p) => !featuredIds.has(p.id));
    filtered = [...featured, ...rest];
  }
  const start = (page - 1) * pageSize;
  return {
    products: filtered.slice(start, start + pageSize),
    total: data.total,
    categories: buildCategories(classified),
    isPartial: true,
  };
}
