import mysql from 'mysql2/promise';

// Current state: IDs 1-51 are real, then big IDs: 60001, 90001... 330001
// We need to map the big IDs to 52-62
// ID 51 = @salomiii_ (already exists)
// Big IDs in order: 30001, 60001, 90001, 120001, 150001, 180001, 210001, 240001, 270001, 300001, 330001

const mapping = [
  { oldId: 30001, newId: 52 },
  { oldId: 60001, newId: 53 },
  { oldId: 90001, newId: 54 },
  { oldId: 120001, newId: 55 },
  { oldId: 150001, newId: 56 },
  { oldId: 180001, newId: 57 },
  { oldId: 210001, newId: 58 },
  { oldId: 240001, newId: 59 },
  { oldId: 270001, newId: 60 },
  { oldId: 300001, newId: 61 },
  { oldId: 330001, newId: 62 },
];

const relatedTables = ['featured_posts', 'journal_entries', 'builder_submissions', 'x_activity', 'telegram_activity'];

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Step 1: Move all big IDs to temp IDs (add 1000000 to avoid conflicts)
    for (const { oldId } of mapping) {
      const tempId = oldId + 1000000;
      console.log(`Temp: ${oldId} → ${tempId}`);
      for (const table of relatedTables) {
        await conn.query(`UPDATE ${table} SET applicationId = ? WHERE applicationId = ?`, [tempId, oldId]);
      }
      await conn.query('UPDATE ambassador_applications SET id = ? WHERE id = ?', [tempId, oldId]);
    }
    
    // Step 2: Move temp IDs to final sequential IDs
    for (const { oldId, newId } of mapping) {
      const tempId = oldId + 1000000;
      console.log(`Final: ${tempId} → ${newId}`);
      for (const table of relatedTables) {
        await conn.query(`UPDATE ${table} SET applicationId = ? WHERE applicationId = ?`, [newId, tempId]);
      }
      await conn.query('UPDATE ambassador_applications SET id = ? WHERE id = ?', [newId, tempId]);
    }
    
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Verify
    const [rows] = await conn.query('SELECT id, twitterHandle FROM ambassador_applications ORDER BY id ASC');
    console.log('\nFinal IDs:');
    rows.forEach(r => console.log(`  #${r.id}: ${r.twitterHandle || '(no handle)'}`));
    console.log('Total:', rows.length);
    
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    throw err;
  } finally {
    await conn.end();
  }
}

run().catch(console.error);
