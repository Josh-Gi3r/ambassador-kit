import * as cheerio from "cheerio";
import { getDb } from "./db";
import { telegramActivity, telegramBatches, ambassadorApplications } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface ParsedTelegramMessage {
  messageId: string;
  senderDisplayName: string;
  text: string | null;
  timestamp: Date;
  isReply: boolean;
  replyToMessageId: string | null;
  hasMedia: boolean;
  reactions: string[];
}

export interface TelegramParseResult {
  batchId: string;
  totalMessages: number;
  uniqueSenders: string[];
  unmatchedSenders: string[];
  matchedCount: number;
}

/**
 * Parse Telegram HTML export and extract all messages.
 * Handles "joined" messages (consecutive messages from same sender with no from_name).
 */
export function parseTelegramHtml(html: string): ParsedTelegramMessage[] {
  const $ = cheerio.load(html);
  const messages: ParsedTelegramMessage[] = [];
  let lastSenderName = "";

  $(".message.default").each((_, el) => {
    const $el = $(el);
    const idAttr = $el.attr("id") || "";
    const messageId = idAttr.replace("message", "");
    if (!messageId) return;

    // Determine sender — joined messages have no from_name, inherit from previous
    const fromNameEl = $el.find(".from_name").first();
    const senderDisplayName = fromNameEl.length
      ? fromNameEl.text().trim()
      : lastSenderName;

    if (fromNameEl.length) {
      lastSenderName = senderDisplayName;
    }

    // Skip messages with no sender
    if (!senderDisplayName) return;

    // Extract timestamp from title attribute
    const dateTitle = $el.find(".date.details").attr("title") || "";
    let timestamp = new Date();
    if (dateTitle) {
      // Format: "05.03.2026 10:21:29 UTC+08:00"
      const match = dateTitle.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})/);
      if (match) {
        const [, day, month, year, time] = match;
        timestamp = new Date(`${year}-${month}-${day}T${time}+08:00`);
      }
    }

    // Extract text content
    const textEl = $el.find(".text").first();
    const text = textEl.length ? textEl.text().trim() || null : null;

    // Check for reply
    const replyEl = $el.find(".reply_to.details").first();
    let isReply = false;
    let replyToMessageId: string | null = null;
    if (replyEl.length) {
      isReply = true;
      const replyHref = replyEl.find("a").attr("href") || "";
      const replyMatch = replyHref.match(/go_to_message(\d+)/);
      if (replyMatch) {
        replyToMessageId = replyMatch[1];
      }
    }

    // Check for media
    const hasMedia = $el.find(".media_wrap").length > 0;

    // Extract reactions
    const reactions: string[] = [];
    $el.find(".reaction .emoji").each((_, emojiEl) => {
      reactions.push($(emojiEl).text().trim());
    });

    messages.push({
      messageId,
      senderDisplayName,
      text,
      timestamp,
      isReply,
      replyToMessageId,
      hasMedia,
      reactions,
    });
  });

  return messages;
}

/**
 * Normalize a string for matching: lowercase, strip @, trim whitespace.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/^@/, "").replace(/\s+/g, "").trim();
}

type AppRecord = { id: number; telegramHandle: string | null; twitterHandle: string | null };

/**
 * Build two lookup maps:
 * - tgMap: telegramHandle (normalized) → applicationId (highest priority)
 * - allMap: telegramHandle + twitterHandle (normalized) → applicationId
 */
function buildMatchMaps(allApps: AppRecord[]): {
  tgMap: Map<string, number>;
  allMap: Map<string, number>;
} {
  const tgMap = new Map<string, number>();
  const allMap = new Map<string, number>();
  for (const app of allApps) {
    if (app.telegramHandle) {
      const key = norm(app.telegramHandle);
      if (key) {
        if (!tgMap.has(key)) tgMap.set(key, app.id);
        if (!allMap.has(key)) allMap.set(key, app.id);
      }
    }
    if (app.twitterHandle) {
      const key = norm(app.twitterHandle);
      if (key && !allMap.has(key)) allMap.set(key, app.id);
    }
  }
  return { tgMap, allMap };
}

/**
 * Try to resolve a Telegram display name to an ambassador application ID.
 *
 * Matching strategy (in priority order):
 * 1. Exact match on telegramHandle (highest confidence)
 * 2. Exact match on twitterHandle
 * 3. Collapsed display name ("Mohil Sheth" → "mohilsheth") vs telegramHandle
 * 4. Collapsed display name vs twitterHandle
 * 5. Prefix match vs telegramHandle only — prefer tgMap on tie-break
 *    e.g. "Avii" matches "aviionchain" (tg) over "aviiweb3" (twitter)
 * 6. First-word prefix match vs telegramHandle only — unambiguous only
 */
function resolveDisplayName(
  displayName: string,
  tgMap: Map<string, number>,
  allMap: Map<string, number>
): number | null {
  const directKey = norm(displayName);

  // Strategy 1: exact telegramHandle match
  if (tgMap.has(directKey)) return tgMap.get(directKey)!;

  // Strategy 2: exact twitterHandle (or any handle) match
  if (allMap.has(directKey)) return allMap.get(directKey)!;

  const collapsed = displayName.toLowerCase().replace(/\s+/g, "").replace(/^@/, "").trim();

  // Strategy 3: collapsed display name vs telegramHandle
  if (collapsed && tgMap.has(collapsed)) return tgMap.get(collapsed)!;

  // Strategy 4: collapsed display name vs any handle
  if (collapsed && allMap.has(collapsed)) return allMap.get(collapsed)!;

  // Strategy 5: prefix match — prefer telegramHandle matches over twitter on tie-break
  // e.g. "Avii" → "aviionchain" (tg) wins over "aviiweb3" (twitter)
  const tgEntries = Array.from(tgMap.entries());
  const allEntries = Array.from(allMap.entries());

  const tgPrefixMatches: number[] = [];
  for (const [key, id] of tgEntries) {
    if (key.startsWith(collapsed) || collapsed.startsWith(key)) {
      tgPrefixMatches.push(id);
    }
  }
  // If exactly one telegramHandle matches the prefix — use it
  if (tgPrefixMatches.length === 1) return tgPrefixMatches[0];

  // Fall back to all handles prefix match (unambiguous only)
  const allPrefixMatches: number[] = [];
  for (const [key, id] of allEntries) {
    if (key.startsWith(collapsed) || collapsed.startsWith(key)) {
      if (!allPrefixMatches.includes(id)) allPrefixMatches.push(id);
    }
  }
  if (allPrefixMatches.length === 1) return allPrefixMatches[0];

  // Strategy 6: first word of display name as prefix match vs telegramHandle only
  const firstWord = displayName.split(/\s+/)[0].toLowerCase().replace(/^@/, "");
  if (firstWord.length >= 4) {
    const tgFirstWordMatches: number[] = [];
    for (const [key, id] of tgEntries) {
      if (key.startsWith(firstWord) || firstWord.startsWith(key)) {
        tgFirstWordMatches.push(id);
      }
    }
    if (tgFirstWordMatches.length === 1) return tgFirstWordMatches[0];

    // Last resort: first word vs all handles, unambiguous only
    const allFirstWordMatches: number[] = [];
    for (const [key, id] of allEntries) {
      if (key.startsWith(firstWord) || firstWord.startsWith(key)) {
        if (!allFirstWordMatches.includes(id)) allFirstWordMatches.push(id);
      }
    }
    if (allFirstWordMatches.length === 1) return allFirstWordMatches[0];
  }

  return null;
}

/**
 * Store parsed messages in the database and return batch info.
 *
 * Auto-mapping strategy (MASTER.md Section 16):
 * 1. telegramHandle from application (exact match)
 * 2. twitterHandle from application (many ambassadors use same handle on both platforms)
 * 3. Collapsed display name match ("Mohil Sheth" → "mohilsheth")
 * 4. First-word prefix match ("Haruki" → "haruki_web3") — only if unambiguous
 *
 * Any messages that still can't be matched are stored with applicationId = null
 * and surfaced in unmatchedSenders for manual mapping via the admin UI.
 */
export async function storeTelegramBatch(
  messages: ParsedTelegramMessage[],
  filename: string
): Promise<TelegramParseResult> {
  const batchId = randomUUID();

  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Load all ambassadors with all identity signals
  const allApps = await database
    .select({
      id: ambassadorApplications.id,
      telegramHandle: ambassadorApplications.telegramHandle,
      twitterHandle: ambassadorApplications.twitterHandle,
    })
    .from(ambassadorApplications);

  // Build the multi-signal match maps
  const { tgMap, allMap } = buildMatchMaps(allApps);

  // Get unique senders
  const senderSet = new Set<string>();
  for (const m of messages) senderSet.add(m.senderDisplayName);
  const uniqueSenders = Array.from(senderSet);

  // Pre-resolve all unique senders so we don't repeat work per message
  const senderToAppId = new Map<string, number | null>();
  for (const sender of uniqueSenders) {
    senderToAppId.set(sender, resolveDisplayName(sender, tgMap, allMap));
  }

  const unmatchedSenders: string[] = [];
  let matchedCount = 0;

  for (const sender of uniqueSenders) {
    if (senderToAppId.get(sender) !== null) {
      matchedCount++;
    } else {
      unmatchedSenders.push(sender);
    }
  }

  // Create batch record
  await database.insert(telegramBatches).values({
    id: batchId,
    filename,
    messageCount: messages.length,
    matchedCount,
  });

  // Insert messages
  for (const msg of messages) {
    const applicationId = senderToAppId.get(msg.senderDisplayName) ?? null;
    const messageType = msg.isReply ? "reply" : "message";

    // onDuplicateKeyUpdate with a no-op acts as INSERT IGNORE:
    // if messageId already exists (re-upload), silently skip without throwing.
    await database.insert(telegramActivity).values({
      applicationId,
      telegramHandle: msg.senderDisplayName, // store display name for reference
      messageId: msg.messageId,
      text: msg.text ?? "",
      messageType,
      replyToId: msg.replyToMessageId,
      sentAt: msg.timestamp,
      uploadBatchId: batchId,
    }).onDuplicateKeyUpdate({ set: { messageId: msg.messageId } });
  }

  return {
    batchId,
    totalMessages: messages.length,
    uniqueSenders,
    unmatchedSenders,
    matchedCount,
  };
}

/**
 * Re-run auto-matching against all telegram_activity rows where applicationId IS NULL.
 * Call this after the matching logic is updated to fix previously unmatched rows.
 * Returns the number of rows that were successfully matched.
 */
export async function rematchNullRows(): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Load all ambassadors
  const allApps = await database
    .select({
      id: ambassadorApplications.id,
      telegramHandle: ambassadorApplications.telegramHandle,
      twitterHandle: ambassadorApplications.twitterHandle,
    })
    .from(ambassadorApplications);

  const { tgMap, allMap } = buildMatchMaps(allApps);

  // Get all distinct unmatched senders
  const { isNull } = await import("drizzle-orm");
  const unmatchedRows = await database
    .selectDistinct({ senderDisplayName: telegramActivity.telegramHandle })
    .from(telegramActivity)
    .where(isNull(telegramActivity.applicationId));

  let fixedCount = 0;
  for (const row of unmatchedRows) {
    const appId = resolveDisplayName(row.senderDisplayName, tgMap, allMap);
    if (appId !== null) {
      await database
        .update(telegramActivity)
        .set({ applicationId: appId })
        .where(eq(telegramActivity.telegramHandle, row.senderDisplayName));
      fixedCount++;
    }
  }

  return fixedCount;
}

/**
 * Map a Telegram display name to an ambassador application.
 * This is the one-time manual mapping step.
 */
export async function mapTelegramSenderToAmbassador(
  displayName: string,
  applicationId: number
): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  // Update all unmatched messages from this sender
  await database
    .update(telegramActivity)
    .set({ applicationId })
    .where(eq(telegramActivity.telegramHandle, displayName));
}
