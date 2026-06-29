/**
 * One-shot script: recompute lifetime_xp, xp_30day, xp_90day for all ambassadors
 * from the xp_events ledger. Run with: node scripts/recompute-xp-caches.mjs
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('Fetching all ambassador IDs...');
const [ambassadors] = await conn.execute(
  'SELECT id FROM ambassador_applications WHERE level >= 0'
);
console.log(`Found ${ambassadors.length} ambassadors`);

let updated = 0;
for (const { id } of ambassadors) {
  const [[sums]] = await conn.execute(`
    SELECT 
      COALESCE(SUM(xp_amount), 0) as lifetime,
      COALESCE(SUM(CASE WHEN awarded_at >= NOW() - INTERVAL 30 DAY THEN xp_amount ELSE 0 END), 0) as d30,
      COALESCE(SUM(CASE WHEN awarded_at >= NOW() - INTERVAL 90 DAY THEN xp_amount ELSE 0 END), 0) as d90
    FROM xp_events
    WHERE application_id = ?
  `, [id]);
  
  const lifetime = Math.max(0, Number(sums.lifetime));
  const d30 = Math.max(0, Number(sums.d30));
  const d90 = Math.max(0, Number(sums.d90));
  
  await conn.execute(
    'UPDATE ambassador_applications SET lifetime_xp = ?, xp_30day = ?, xp_90day = ? WHERE id = ?',
    [lifetime, d30, d90, id]
  );
  updated++;
  if (updated % 20 === 0) console.log(`  Updated ${updated}/${ambassadors.length}...`);
}

console.log(`\nDone! Updated ${updated} ambassadors.`);

// Show top 10
const [top10] = await conn.execute(`
  SELECT id, lifetime_xp, xp_30day, xp_90day 
  FROM ambassador_applications 
  WHERE level >= 1 
  ORDER BY lifetime_xp DESC 
  LIMIT 10
`);
console.log('\nTop 10 by Lifetime XP:');
top10.forEach((r, i) => console.log(`  #${i+1} id=${r.id}: lifetime=${r.lifetime_xp}, 30d=${r.xp_30day}, 90d=${r.xp_90day}`));

await conn.end();
