/**
 * Shared authorization helpers used across tRPC routers.
 *
 * `assertOwnsApplication(ctx, applicationId)` is the single source of
 * truth for "is the logged-in user allowed to touch this ambassador row?".
 * The resolution order mirrors `getAIContext` in `server/ai/getAIContext.ts`
 * so dashboard, journal, builder, wallet, and AI procedures agree on
 * ownership.
 *
 * Admins bypass the check.
 */
import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import {
  getApplicationByEmail,
  getApplicationByClaimedTgOpenId,
  getApplicationByTelegramHandle,
} from "../db";

type AppRow = { id: number; [k: string]: unknown };

async function resolveApplicationForUser(user: User): Promise<AppRow | null> {
  if (user.openId?.startsWith("tg:")) {
    const claimed = await getApplicationByClaimedTgOpenId(user.openId);
    if (claimed) return claimed as AppRow;
    if (user.name) {
      const byHandle = await getApplicationByTelegramHandle(user.name);
      if (byHandle) return byHandle as AppRow;
    }
    return null;
  }
  if (!user.email) return null;
  const byEmail = await getApplicationByEmail(user.email);
  return (byEmail as AppRow) ?? null;
}

/**
 * Throw FORBIDDEN unless the logged-in user owns `applicationId` (or is
 * admin). Returns the resolved owning application on success so callers
 * don't have to look it up twice.
 */
export async function assertOwnsApplication(
  user: User,
  applicationId: number,
): Promise<AppRow> {
  if (user.role === "admin") {
    // Admin may operate on any application — fetch it for downstream use.
    const own = await resolveApplicationForUser(user);
    if (own && own.id === applicationId) return own;
    // For admin-on-someone-else, we still need the target row. Look it up.
    const { getApplicationById } = await import("../db");
    const row = await getApplicationById(applicationId);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
    }
    return row as AppRow;
  }

  const own = await resolveApplicationForUser(user);
  if (!own) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No ambassador application is linked to your account.",
    });
  }
  if (own.id !== applicationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only modify your own ambassador record.",
    });
  }
  return own;
}

/**
 * Like `assertOwnsApplication`, but returns the application id instead of
 * accepting one — for procedures that should always operate on the
 * caller's row regardless of what they submit. Throws if no application is
 * linked.
 */
export async function resolveOwnApplicationId(user: User): Promise<number> {
  const own = await resolveApplicationForUser(user);
  if (!own) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No ambassador application is linked to your account.",
    });
  }
  return own.id;
}
