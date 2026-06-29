// Minimal flat-config ESLint setup. Q1 — was previously absent.
// Intentionally light: no autofixing on save (Prettier owns formatting),
// just catches "shouldn't have shipped" issues like accidentally
// committed `console.log` in HTTP handlers, unused vars, == vs ===.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Batch jobs / one-off scripts / pipelines may use console.log freely.
    files: [
      "server/xScraper.ts",
      "server/apifyPipeline.ts",
      "server/scheduler.ts",
      "server/ledgerCron.ts",
      "server/migrateToLedger.ts",
      "server/_core/index.ts",
      "server/_core/sdk.ts",
      "server/_core/voiceTranscription.ts",
      "scripts/**",
      "audit_xp.cjs",
      "scrape_audit.cjs",
      "scrape_staging.mjs",
      "reimport_staging.mjs",
      "seed.mjs",
      "seed_demo.mjs",
      "simulate_xp.mjs",
      "simulate_xp_staging.mjs",
      "run-*.mjs",
      "trigger_*.ts",
    ],
    rules: { "no-console": "off" },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "drizzle/meta/",
      
      "client/public/",
      "patches/",
      "**/*.d.ts",
    ],
  },
];
