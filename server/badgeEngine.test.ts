import { describe, it, expect } from "vitest";
import type { AmbassadorApplication } from "../drizzle/schema";
import { checkEligibility, isoWeekKey } from "./badgeEngine";

function makeApp(overrides: Partial<AmbassadorApplication> = {}): AmbassadorApplication {
  // Cast through unknown — we only set the fields the engine reads.
  return {
    id: 1,
    level: 0,
    status: "pending",
    c4ContentQuality: 0,
    c6CommunityValue: 0,
    c7BuilderOutput: 0,
    c8BuilderDepth: 0,
    testScore: 0,
    xp30day: 0,
    xp90day: 0,
    ...overrides,
  } as unknown as AmbassadorApplication;
}

describe("badgeEngine.checkEligibility", () => {
  it("L1 contributor activates at level >= 1", () => {
    expect(checkEligibility(makeApp({ level: 0 })).l1_contributor).toBe(false);
    expect(checkEligibility(makeApp({ level: 1 })).l1_contributor).toBe(true);
    expect(checkEligibility(makeApp({ level: 5 })).l1_contributor).toBe(true);
  });

  it("L2 ambassador activates only when status === approved", () => {
    expect(checkEligibility(makeApp({ status: "pending" })).l2_ambassador).toBe(false);
    expect(checkEligibility(makeApp({ status: "rejected" })).l2_ambassador).toBe(false);
    expect(checkEligibility(makeApp({ status: "approved" })).l2_ambassador).toBe(true);
  });

  it("steady_hand vs iron_rhythm vs viral_voice ladder", () => {
    // 30-day thresholds: steady@300, viral@600, iron@1200.
    const e1 = checkEligibility(makeApp({ xp30day: 250 }));
    expect(e1.steady_hand).toBe(false);
    const e2 = checkEligibility(makeApp({ xp30day: 300 }));
    expect(e2.steady_hand).toBe(true);
    expect(e2.viral_voice).toBe(false);
    const e3 = checkEligibility(makeApp({ xp30day: 600 }));
    expect(e3.viral_voice).toBe(true);
    expect(e3.iron_rhythm).toBe(false);
    const e4 = checkEligibility(makeApp({ xp30day: 1200 }));
    expect(e4.iron_rhythm).toBe(true);
  });

  it("knowledge badges respect testScore", () => {
    expect(checkEligibility(makeApp({ testScore: 7 })).sharp).toBe(false);
    expect(checkEligibility(makeApp({ testScore: 8 })).sharp).toBe(true);
    expect(checkEligibility(makeApp({ testScore: 9 })).perfect).toBe(false);
    expect(checkEligibility(makeApp({ testScore: 10 })).perfect).toBe(true);
  });

  it("rising fires only when 30d outpaces the older two-thirds of the 90d window", () => {
    // Latent: 30d=0 → never rising
    expect(checkEligibility(makeApp({ xp30day: 0, xp90day: 1000 })).rising).toBe(false);
    // Flat: 30d == 1/3 of 90d → 30d * 2 == 90d - 30d → not strictly greater
    expect(checkEligibility(makeApp({ xp30day: 100, xp90day: 300 })).rising).toBe(false);
    // Accelerating: most XP is recent
    expect(checkEligibility(makeApp({ xp30day: 200, xp90day: 300 })).rising).toBe(true);
  });
});

describe("badgeEngine.isoWeekKey", () => {
  it("formats as YYYY-WNN", () => {
    expect(isoWeekKey(new Date("2026-01-05T12:00:00Z"))).toMatch(/^2026-W\d{2}$/);
  });

  it("is consistent for the same week", () => {
    const monday = isoWeekKey(new Date("2026-03-09T00:00:00Z"));
    const friday = isoWeekKey(new Date("2026-03-13T23:00:00Z"));
    expect(monday).toBe(friday);
  });

  it("rolls over across week boundaries", () => {
    const sun = isoWeekKey(new Date("2026-03-15T12:00:00Z"));
    const mon = isoWeekKey(new Date("2026-03-16T12:00:00Z"));
    expect(sun).not.toBe(mon);
  });
});
