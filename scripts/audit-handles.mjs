import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(`SELECT id, twitterHandle FROM ambassador_applications WHERE level >= 1 ORDER BY totalXP DESC`);

let issues = 0;
for (const r of rows) {
  const h = r.twitterHandle;
  const flags = [];
  if (h === null || h === undefined) {
    flags.push('NULL');
  } else {
    if (h.startsWith('@')) flags.push('has @ prefix');
    if (h.includes(' ')) flags.push('has space');
    if (h.length === 0) flags.push('empty string');
  }
  if (flags.length > 0) {
    console.log(`ID ${r.id} | "${h}" | ${flags.join(', ')}`);
    issues++;
  }
}
console.log(`\nTotal ambassadors: ${rows.length}`);
console.log(`Handles with issues: ${issues}`);
await conn.end();
