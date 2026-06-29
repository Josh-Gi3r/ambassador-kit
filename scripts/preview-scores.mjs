/**
 * preview-scores.mjs
 * 1. Triggers scrapeAllAmbassadorsX() and waits for completion
 * 2. Runs the XP calculation logic in READ-ONLY mode (no DB writes)
 * 3. Prints a table of all ambassador scores to stdout
 *
 * Run: node scripts/preview-scores.mjs
 */
import { createRequire } from "module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Load env
import { config } from "dotenv";
config({ path: path.join(projectRoot, ".env") });
config({ path: path.join(projectRoot, ".env.local") });

// We need ts-node/esm or tsx to load TypeScript files
// Use tsx via child_process instead
import { execSync, spawnSync } from "child_process";

const result = spawnSync(
  "node",
  [
    "--loader", "tsx/esm",
    path.join(__dirname, "preview-scores-inner.ts"),
  ],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    timeout: 600_000, // 10 min max
  }
);

process.exit(result.status ?? 0);
