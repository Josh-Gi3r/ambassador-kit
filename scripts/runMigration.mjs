/**
 * One-time opening balance migration runner.
 * Carries each ambassador's current totalXP into the new xp_events ledger.
 * Idempotent — safe to run multiple times.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all ambassadors
const [apps] = await conn.query(
  'SELECT id, totalXP, twitterHandle FROM ambassador_applications'
);

console.log(`Running opening balance migration for ${apps.length} ambassadors...`);

let carried = 0;
let skipped = 0;
const sample = [];

for (const app of apps) {
  const opening = Math.max(0, Math.round(Number(app.totalXP ?? 0)));
  const sourceRef = `migration-${app.id}`;

  try {
    // Insert opening balance event (idempotent via IGNORE)
    await conn.query(
      `INSERT IGNORE INTO xp_events (application_id, event_type, xp_amount, source, source_ref)
       VALUES (?, 'migration_opening_balance', ?, 'migration', ?)`,
      [app.id, opening, sourceRef]
    );

    // Update lifetime_xp cache
    await conn.query(
      `UPDATE ambassador_applications SET lifetime_xp = ? WHERE id = ?`,
      [opening, app.id]
    );

    carried += opening;
    if (sample.length < 15) {
      sample.push({ id: app.id, handle: app.twitterHandle, opening });
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      skipped++;
    } else {
      console.error(`Error for id ${app.id}:`, err.message);
    }
  }
}

console.log(`\nMigration complete:`);
console.log(`  Ambassadors processed: ${apps.length}`);
console.log(`  Already migrated (skipped): ${skipped}`);
console.log(`  Total XP carried: ${carried}`);
console.log(`\nSample (top 15):`);
sample.forEach(s => console.log(`  id:${s.id} @${s.handle} → ${s.opening} XP`));

// Verify: count events
const [evtCount] = await conn.query('SELECT COUNT(*) as cnt FROM xp_events');
console.log(`\nTotal xp_events rows: ${evtCount[0].cnt}`);

await conn.end();
