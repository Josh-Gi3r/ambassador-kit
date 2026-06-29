/**
 * Telegram Login Widget verification and session creation.
 *
 * Telegram sends a signed payload to the frontend widget callback. The frontend
 * POSTs that payload to /api/auth/telegram. We verify the HMAC-SHA256 signature
 * using the bot token, then upsert the user and issue a session cookie.
 *
 * Reference: https://core.telegram.org/widgets/login#checking-authorization
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import * as db from "./db";

/** Verify the Telegram Login Widget data hash. */
function verifyTelegramHash(data: Record<string, string>): boolean {
  const token = ENV.telegramBotToken;
  if (!token) {
    console.error("[TelegramAuth] TELEGRAM_BOT_TOKEN is not set");
    return false;
  }

  const { hash, ...rest } = data;
  if (!hash) return false;

  // Build the data-check-string: sorted key=value pairs joined by \n
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  // Secret key = SHA-256 of the bot token (NOT HMAC — raw SHA256)
  const secretKey = crypto.createHash("sha256").update(token).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  return expectedHash === hash;
}

export function registerTelegramAuthRoutes(app: Express) {
  app.post("/api/auth/telegram", async (req: Request, res: Response) => {
    try {
      const data = req.body as Record<string, string>;

      if (!data || typeof data !== "object") {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      // Verify the Telegram signature
      if (!verifyTelegramHash(data)) {
        res.status(401).json({ error: "Invalid Telegram signature" });
        return;
      }

      // Check auth_date is not too old (prevent replay attacks).
      // S7 fix — was 86400s (24h). A captured payload should not be valid
      // for that long. 5 minutes is more than enough for a real login.
      const authDate = parseInt(data.auth_date ?? "0", 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 300) {
        res.status(401).json({ error: "Auth data expired" });
        return;
      }

      const telegramId = data.id;
      const firstName = data.first_name ?? "";
      const lastName = data.last_name ?? "";
      const username = data.username ?? null;
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || username || `tg_${telegramId}`;

      // Use telegramId as the openId with a tg: prefix to avoid collisions with OAuth openIds
      const openId = `tg:${telegramId}`;

      // Upsert the user record
      await db.upsertUser({
        openId,
        telegramId,
        name: displayName,
        loginMethod: "telegram",
        lastSignedIn: new Date(),
      });

      // Auto-promote if email matches admin list (Telegram users won't have email,
      // but the owner openId check still applies)
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Failed to create user record" });
        return;
      }

      // Create session JWT
      const sessionToken = await sdk.signSession(
        { openId, appId: ENV.appId, name: displayName },
        { expiresInMs: ONE_YEAR_MS }
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Return the user info so the frontend can immediately use it
      res.json({
        success: true,
        user: {
          id: user.id,
          openId: user.openId,
          telegramId: user.telegramId,
          name: user.name,
          role: user.role,
          username,
        },
      });
    } catch (error) {
      console.error("[TelegramAuth] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
