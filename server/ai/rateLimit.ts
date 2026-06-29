import { TRPCError } from "@trpc/server";

// Per-ambassador in-memory rate limit for generative AI actions. Second line
// of defence behind LiteLLM's own budgets. In-process is sufficient at
// ambassador scale (single Railway instance); swap for Redis if it scales out.

const HITS = new Map<number, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Returns true if allowed; false if the hourly cap is exceeded. */
export function allowAiAction(applicationId: number, maxPerHour = 30): boolean {
  const now = Date.now();
  const e = HITS.get(applicationId);
  if (!e || e.resetAt < now) {
    HITS.set(applicationId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count >= maxPerHour) return false;
  e.count++;
  return true;
}

/** Throws a friendly tRPC error when the cap is hit. */
export function enforceAiRateLimit(applicationId: number, maxPerHour = 30) {
  if (!allowAiAction(applicationId, maxPerHour)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "You've hit the hourly generation limit. Try again a bit later.",
    });
  }
}
