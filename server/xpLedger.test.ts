import { describe, it, expect } from "vitest";
import { EARN } from "./xpLedger";

describe("xpLedger EARN table (Build Bible v1.2 Part 4.2/4.3)", () => {
  it("has all integer values", () => {
    for (const [k, v] of Object.entries(EARN)) {
      expect(Number.isInteger(v), `EARN.${k} should be integer`).toBe(true);
    }
  });

  it("all values are positive (no negatives in the constants — that's reserved for admin reversals)", () => {
    for (const [k, v] of Object.entries(EARN)) {
      expect(v, `EARN.${k} should be > 0`).toBeGreaterThan(0);
    }
  });

  it("build events outweigh routine content events", () => {
    expect(EARN.build_integration).toBeGreaterThan(EARN.post);
    expect(EARN.build_repo).toBeGreaterThan(EARN.thread);
    expect(EARN.build_article).toBeGreaterThan(EARN.reply * 10);
  });

  it("'received' engagement is denser than 'given' engagement", () => {
    expect(EARN.received_repost).toBeGreaterThan(EARN.repost);
    expect(EARN.received_quote).toBeGreaterThan(EARN.quote);
    expect(EARN.received_reply).toBeGreaterThan(EARN.reply);
  });

  it("quest values are bounded sanely (no 5-digit quest)", () => {
    const questKeys = Object.keys(EARN).filter(k => k.startsWith("quest_"));
    for (const k of questKeys) {
      expect((EARN as Record<string, number>)[k]).toBeLessThanOrEqual(500);
    }
  });
});
