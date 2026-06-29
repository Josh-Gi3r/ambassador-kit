import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── MOCK DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createApplication: vi.fn().mockResolvedValue(42),
  checkEmailForApplication: vi.fn().mockResolvedValue(null),
  updateApplicationProgress: vi.fn().mockResolvedValue(undefined),
  listApplications: vi.fn().mockResolvedValue([
    {
      id: 1,
      email: "alice@example.com",
      isEvangelist: 0,
      lastStep: "submitted",
      tracks: ["community"],
      contributionIntent: ["Creating educational content"],
      testScore: 10,
      communities: "1. Crypto Philippines — 4000-member Filipino crypto community",
      twitterHandle: "@alicetan",
      telegramHandle: "@alicetan",
      githubHandle: null,
      otherLinks: null,
      hasCommunityExperience: "yes",
      communityLinks: null,
      protocolDescription: "This protocol enables on-chain cross-border settlement.",
      communityBenefit: "It helps my community send money across borders cheaply.",
      firstThirtyDays: "I will host a meetup and create 3 educational posts.",
      status: "pending",
      adminNotes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ]),
  getApplicationById: vi.fn().mockResolvedValue({
    id: 1,
    email: "alice@example.com",
    isEvangelist: 0,
    lastStep: "submitted",
    tracks: ["community"],
    contributionIntent: ["Creating educational content"],
    testScore: 10,
    communities: "1. Crypto Philippines — 4000-member Filipino crypto community",
    twitterHandle: "@alicetan",
    telegramHandle: "@alicetan",
    githubHandle: null,
    otherLinks: null,
    hasCommunityExperience: "yes",
    communityLinks: null,
    protocolDescription: "This protocol enables on-chain cross-border settlement.",
    communityBenefit: "It helps my community send money across borders cheaply.",
    firstThirtyDays: "I will host a meetup and create 3 educational posts.",
    status: "pending",
    adminNotes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }),
  updateApplicationStatus: vi.fn().mockResolvedValue(undefined),
  getApplicationStats: vi.fn().mockResolvedValue({
    total: 10,
    pending: 5,
    approved: 3,
    rejected: 2,
  }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn(),
  scrubAmbassador: (x: unknown) => x,
  confirmClaim: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ── CONTEXT FACTORIES ────────────────────────────────────────────────────────
function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "oauth",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function userCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-open-id",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── VALID SUBMISSION PAYLOAD ──────────────────────────────────────────────────
const validSubmission = {
  email: "alice@example.com",
  isEvangelist: false,
  tracks: ["community"] as ("community" | "developer" | "content")[],
  contributionIntent: ["Creating educational content"],
  testScore: 10,
  communities: "1. Crypto Philippines — 4000-member Filipino crypto community",
  twitterHandle: "@alicetan",
  telegramHandle: "@alicetan",
  hasCommunityExperience: "yes" as const,
  protocolDescription: "This protocol enables on-chain cross-border settlement.",
  communityBenefit: "It helps my community send money across borders cheaply and quickly.",
  firstThirtyDays: "I will host a meetup and create 3 educational posts about the protocol.",
};

// ── TESTS ────────────────────────────────────────────────────────────────────
describe("ambassador.checkEmail", () => {
  it("returns exists:false for an unknown email", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const result = await caller.ambassador.checkEmail({ email: "unknown@example.com" });
    expect(result.exists).toBe(false);
    expect(result.isEvangelist).toBe(false);
  });
});

describe("ambassador.submit", () => {
  it("accepts a valid application and returns success with id", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const result = await caller.ambassador.submit(validSubmission);
    expect(result.success).toBe(true);
    expect(result.id).toBe(42);
  });

  it("rejects a submission with an invalid email", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.ambassador.submit({ ...validSubmission, email: "not-an-email" })
    ).rejects.toThrow();
  });

  it("rejects a submission with communities string too short", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.ambassador.submit({ ...validSubmission, communities: "short" })
    ).rejects.toThrow();
  });

  it("rejects a submission with empty tracks array", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.ambassador.submit({ ...validSubmission, tracks: [] })
    ).rejects.toThrow();
  });

  it("rejects a submission with communityBenefit too short", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.ambassador.submit({ ...validSubmission, communityBenefit: "too short" })
    ).rejects.toThrow();
  });
});

describe("ambassador.stats", () => {
  it("returns aggregate stats publicly", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const stats = await caller.ambassador.stats();
    expect(stats.total).toBe(10);
    expect(stats.pending).toBe(5);
    expect(stats.approved).toBe(3);
  });
});

describe("ambassador.list (admin guard)", () => {
  it("returns applications for admin users", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const apps = await caller.ambassador.list({});
    expect(Array.isArray(apps)).toBe(true);
    expect(apps.length).toBeGreaterThan(0);
  });

  it("throws FORBIDDEN for non-admin authenticated users", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect(caller.ambassador.list({})).rejects.toThrow("Admin access required");
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(caller.ambassador.list({})).rejects.toThrow();
  });
});

describe("ambassador.updateStatus (admin guard)", () => {
  it("allows admin to update application status", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.ambassador.updateStatus({
      id: 1,
      status: "approved",
      adminNotes: "Strong candidate.",
    });
    expect(result.success).toBe(true);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect(
      caller.ambassador.updateStatus({ id: 1, status: "approved" })
    ).rejects.toThrow("Admin access required");
  });
});

describe("ambassador.getById (admin guard)", () => {
  it("returns application detail for admin", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const app = await caller.ambassador.getById({ id: 1 });
    expect(app.id).toBe(1);
    expect(app.email).toBe("alice@example.com");
  });

  it("throws FORBIDDEN for regular users", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect(caller.ambassador.getById({ id: 1 })).rejects.toThrow(
      "Admin access required"
    );
  });
});
