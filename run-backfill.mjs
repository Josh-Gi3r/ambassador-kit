/**
 * Standalone backfill script - triggers scrapeAllAmbassadorsX from 2026-03-19
 * Run with: node run-backfill.mjs
 */
import { createRequire } from 'module';
import { register } from 'node:module';
import { pathToFileURL } from 'url';

// Use tsx to run TypeScript directly
import { execSync } from 'child_process';

const result = execSync(
  'npx tsx -e "import { scrapeAllAmbassadorsX } from \'./server/xScraper\'; scrapeAllAmbassadorsX(\'2026-03-19\').then(r => { console.log(\'STARTED:\', JSON.stringify(r)); }).catch(e => { console.error(\'ERROR:\', e.message); process.exit(1); })"',
  { cwd: process.env.APP_DIR ?? '/app', encoding: 'utf8', timeout: 10000 }
);
console.log(result);
