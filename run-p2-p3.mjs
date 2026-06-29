/**
 * Standalone script to run Pipeline 2 (official engagement) and Pipeline 3 (conversation threads)
 * directly from the server without needing the browser.
 */
import { config } from "dotenv";
config();

// Dynamically import compiled server modules via tsx
import { createRequire } from "module";
import { register } from "tsx/esm/api";

register();

const { scrapeOfficialEngagement, scrapeConversationThreads } = await import("./server/xScraper.ts");

console.log("=== Running Pipeline 2: Official Engagement ===");
try {
  const p2 = await scrapeOfficialEngagement();
  console.log(`P2 done: ${p2.runsStarted} runs, ${p2.totalImported} tweets imported`);
} catch (err) {
  console.error("P2 failed:", err.message);
}

console.log("\n=== Running Pipeline 3: Conversation Threads ===");
try {
  const p3 = await scrapeConversationThreads();
  console.log(`P3 done: ${p3.conversationCount} threads, ${p3.imported} replies imported`);
} catch (err) {
  console.error("P3 failed:", err.message);
}

console.log("\nAll done.");
process.exit(0);
