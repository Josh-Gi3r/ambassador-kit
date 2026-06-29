/**
 * Per-IP rate limit for unauthenticated tRPC mutations
 * (apply/submit/updateProgress). Best-effort: trusts the first hop in
 * `x-forwarded-for` or falls back to `req.ip`. In-memory; sufficient for a
 * single Railway instance (same architecture as `server/ai/rateLimit.ts`).
 */
import { TRPCError } from "@trpc/server";
import type { Request } from "express";

type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function ipFromReq(req: Request | undefined): string {
  if (!req) return "unknown";
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.ip ?? "unknown";
}

/**
 * Enforce a per-IP hourly cap on a named action.
 * Throws TRPCError TOO_MANY_REQUESTS once exceeded.
 */
export function enforcePublicRateLimit(
  req: Request | undefined,
  action: string,
  maxPerHour: number,
): void {
  const ip = ipFromReq(req);
  const key = `${action}|${ip}`;
  const now = Date.now();
  const e = BUCKETS.get(key);
  if (!e || e.resetAt < now) {
    BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (e.count >= maxPerHour) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests from your IP. Please try again later.",
    });
  }
  e.count++;
}
