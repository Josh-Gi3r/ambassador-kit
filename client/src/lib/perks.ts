// Ambassador Perks Vault — tier-locked startup deals.
// All deals are greyed out / locked until the ambassador reaches the required tier.
// Deals are curated by the team; redemption links will be added when partnerships are confirmed.

export type PerkTier = "initiate" | "active" | "champion" | "elite";

export interface Perk {
  id: string;
  name: string;
  logo: string; // short text logo / initials
  badge: string; // e.g. "1 Year Free"
  savings: string; // e.g. "Save up to $10,000"
  description: string;
  tier: PerkTier; // minimum tier to unlock
  url: string; // redemption URL — empty means coming soon
  comingSoon?: boolean;
}

export const TIER_RANK: Record<PerkTier, number> = {
  initiate: 1,
  active: 2,
  champion: 3,
  elite: 4,
};

export const TIER_LABELS: Record<PerkTier, string> = {
  initiate: "L1 Initiate",
  active: "L2 Active",
  champion: "L3 Champion",
  elite: "L4 Elite",
};

export const PERKS: Perk[] = [
  {
    id: "notion",
    name: "Notion for Startups",
    logo: "N",
    badge: "6 Months Free — Plus Plan",
    savings: "Save up to $1,200",
    description:
      "The connected workspace for notes, docs, projects, and wikis — used by teams of every size.",
    tier: "initiate",
    url: "",
    comingSoon: true,
  },
  {
    id: "aws-activate",
    name: "AWS Activate",
    logo: "AWS",
    badge: "$5k Credit",
    savings: "Savings: $5,000",
    description:
      "Get $5,000 in AWS credits if you haven't already redeemed credits from other sources. Existing and new users apply.",
    tier: "active",
    url: "",
    comingSoon: true,
  },
  {
    id: "auth0",
    name: "Auth0",
    logo: "A0",
    badge: "1 Year Free",
    savings: "Save up to $10,000",
    description:
      "Auth0 is a cloud solution that includes APIs and tools enabling developers to eliminate the friction of authentication.",
    tier: "active",
    url: "",
    comingSoon: true,
  },
  {
    id: "magnific",
    name: "Magnific (formerly Freepik)",
    logo: "M",
    badge: "50% Discount — Annual Plans, Year 1",
    savings: "Save up to $4,798/year",
    description: "The creative platform to direct your best work.",
    tier: "active",
    url: "",
    comingSoon: true,
  },
  {
    id: "figma",
    name: "Figma for Startups",
    logo: "Fig",
    badge: "1 Year Free — Professional Plan",
    savings: "Save up to $1,800",
    description:
      "Design, prototype, and collaborate in one place. The industry-standard tool for product and brand design.",
    tier: "active",
    url: "",
    comingSoon: true,
  },
  {
    id: "algolia",
    name: "Algolia for Startups",
    logo: "Alg",
    badge: "$10k in Credits for 1 Year",
    savings: "Save up to $10,000",
    description:
      "An API-first, hosted search platform for building full-stack AI search & discovery experiences.",
    tier: "champion",
    url: "",
    comingSoon: true,
  },
  {
    id: "atlassian",
    name: "Atlassian for Startups",
    logo: "Atl",
    badge: "12 Months Free — All Products, up to 50 Users",
    savings: "Save up to $10,000",
    description:
      "Empowering teams with collaboration software like Jira, Confluence, and Trello for software, IT, and business projects.",
    tier: "champion",
    url: "",
    comingSoon: true,
  },
  {
    id: "hubspot",
    name: "HubSpot for Startups",
    logo: "HS",
    badge: "Up to 90% Off — Year 1",
    savings: "Save up to $27,000",
    description:
      "CRM, marketing, sales, and service software that grows with your business.",
    tier: "champion",
    url: "",
    comingSoon: true,
  },
  {
    id: "stripe-atlas",
    name: "Stripe Atlas",
    logo: "S",
    badge: "$500 Credit",
    savings: "Savings: $500",
    description:
      "Incorporate your company, get a US bank account, and access Stripe's global payments infrastructure.",
    tier: "elite",
    url: "",
    comingSoon: true,
  },
];
