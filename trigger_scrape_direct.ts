import { scrapeAllAmbassadorsX } from './server/xScraper';

async function main() {
  console.log('Starting backfill scrape from 2026-03-19...');
  const result = await scrapeAllAmbassadorsX('2026-03-19');
  console.log('Scrape job started:', JSON.stringify(result));
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
