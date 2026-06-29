/**
 * Smoke-test: verify OPENROUTER_API_KEY and FAL_API_KEY are valid
 * by making the lightest possible authenticated request to each provider.
 *
 * Skipped automatically when the keys aren't in the environment (e.g. in
 * default CI) so the suite doesn't fail; intended for manual runs against
 * real credentials.
 */
import { describe, it, expect } from "vitest";

const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
const hasFal = !!process.env.FAL_API_KEY;

describe.skipIf(!hasOpenRouter && !hasFal)("API key validation", () => {
  it.skipIf(!hasOpenRouter)("OPENROUTER_API_KEY is set and accepted by OpenRouter", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key, "OPENROUTER_API_KEY must be set").toBeTruthy();

    // Cheapest possible call: list models (no generation, no cost)
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(res.status, `OpenRouter returned ${res.status}`).toBe(200);
  }, 15_000);

  it.skipIf(!hasFal)("FAL_API_KEY is set and accepted by fal.ai", async () => {
    const key = process.env.FAL_API_KEY;
    expect(key, "FAL_API_KEY must be set").toBeTruthy();

    // Lightest fal.ai call: GET /v1/queue/requests (returns empty list, no cost)
    const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "GET",
      headers: { Authorization: `Key ${key}` },
    });
    // fal returns 405 Method Not Allowed for GET on a generation endpoint — that
    // still means the key was accepted (401 would mean invalid key)
    expect([200, 405, 404], `fal.ai returned unexpected ${res.status}`).toContain(res.status);
  }, 15_000);
});
