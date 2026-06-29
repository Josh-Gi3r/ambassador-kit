import { describe, it, expect } from "vitest";
import {
  COMPONENT_MAX,
  TOTAL_MAX_XP,
  applyDecay,
  c1FromPostCount,
  c5FromMsgCount,
  calculateC4,
  calculateC6,
  mapAdminScore,
} from "./xpEngine";

describe("xpEngine: pure helpers (Q1)", () => {
  describe("mapAdminScore", () => {
    it("returns 0 for non-positive scores", () => {
      expect(mapAdminScore(0, 10)).toBe(0);
      expect(mapAdminScore(-2, 10)).toBe(0);
    });

    it("scales the raw 0-10 input to the component max", () => {
      expect(mapAdminScore(10, 8)).toBe(8);
      expect(mapAdminScore(5, 10)).toBe(5);
    });

    it("clamps at the configured max", () => {
      expect(mapAdminScore(15, 8)).toBe(8);
    });
  });

  describe("applyDecay (25%/week)", () => {
    it("returns input unchanged when updatedAt is null", () => {
      expect(applyDecay(10, null)).toBe(10);
    });

    it("returns 0 when value is non-positive", () => {
      expect(applyDecay(0, new Date())).toBe(0);
    });

    it("decays by ~25% after one week", () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const got = applyDecay(10, oneWeekAgo);
      // 10 * 0.75^1 = 7.5
      expect(got).toBeGreaterThan(7.49);
      expect(got).toBeLessThan(7.51);
    });

    it("decays to ~31.6% (0.75^4) after four weeks", () => {
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      const got = applyDecay(10, fourWeeksAgo);
      expect(got).toBeGreaterThan(3.16);
      expect(got).toBeLessThan(3.17);
    });

    it("never returns negative", () => {
      const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      expect(applyDecay(10, longAgo)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("c1FromPostCount step-function", () => {
    it("matches MASTER.md scoring table", () => {
      expect(c1FromPostCount(0, 0)).toBe(0);
      expect(c1FromPostCount(1, 0)).toBe(2);
      expect(c1FromPostCount(2, 0)).toBe(5);
      expect(c1FromPostCount(3, 0)).toBe(5);
      expect(c1FromPostCount(4, 0)).toBe(8);
      expect(c1FromPostCount(5, 0)).toBe(8);
      expect(c1FromPostCount(6, 0)).toBe(10);
      expect(c1FromPostCount(7, 0)).toBe(10);
      expect(c1FromPostCount(8, 0)).toBe(12);
      expect(c1FromPostCount(100, 0)).toBe(12); // capped
    });
  });

  describe("c5FromMsgCount step-function", () => {
    it("matches MASTER.md scoring table", () => {
      expect(c5FromMsgCount(0)).toBe(0);
      expect(c5FromMsgCount(1)).toBe(1);
      expect(c5FromMsgCount(4)).toBe(1);
      expect(c5FromMsgCount(5)).toBe(3);
      expect(c5FromMsgCount(9)).toBe(3);
      expect(c5FromMsgCount(10)).toBe(5);
      expect(c5FromMsgCount(19)).toBe(5);
      expect(c5FromMsgCount(20)).toBe(7);
      expect(c5FromMsgCount(29)).toBe(7);
      expect(c5FromMsgCount(30)).toBe(8);
      expect(c5FromMsgCount(500)).toBe(8); // capped
    });
  });

  describe("calculateC4 + calculateC6 use decay", () => {
    it("returns the raw mapped score for a fresh updatedAt", () => {
      const now = new Date();
      // C4 max is 10; raw 10 → 10
      expect(calculateC4(10, now)).toBeCloseTo(COMPONENT_MAX.c4, 5);
      expect(calculateC6(10, now)).toBeCloseTo(COMPONENT_MAX.c6, 5);
    });

    it("decays over time", () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fresh = calculateC4(10, new Date());
      const stale = calculateC4(10, oneWeekAgo);
      expect(stale).toBeLessThan(fresh);
    });
  });

  describe("COMPONENT_MAX totals", () => {
    it("sums to TOTAL_MAX_XP (100)", () => {
      const sum = Object.values(COMPONENT_MAX).reduce((a, b) => a + b, 0);
      expect(sum).toBe(TOTAL_MAX_XP);
    });
  });
});
