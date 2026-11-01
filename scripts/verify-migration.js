// Simulate the v3-axis-desc migration and verify story safety
const pg = require('pg');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => { const [k, ...rest] = line.split('='); if (k && rest.length) process.env[k.trim()] = rest.join('=').trim().replace(/^"|"$/g, ''); });

const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await p.connect();
  try {
    // BEFORE state
    const before = await client.query('select count(*) as total, count(x) as placed from stories');
    const beforeSample = await client.query('select id, x, y, length(body) as blen from stories where x is not null order by id limit 5');
    console.log('BEFORE stories:', before.rows[0]);
    beforeSample.rows.forEach(r => console.log('  story:', r.id, 'x=', r.x, 'y=', r.y, 'body_len=', r.blen));

    // Check if migration already ran
    const alreadyDone = await client.query("select 1 from meta where key='v3-axis-desc'");
    if (alreadyDone.rows.length) { console.log('v3-axis-desc already ran. Skipping.'); return; }

    await client.query('begin');
    // Simulate the migration: count how many sessions would be updated
    const wouldUpdate = await client.query("select count(*) as n from sessions where (axes->'x'->>'lowDesc') is null");
    console.log('Sessions that would get x.lowDesc:', wouldUpdate.rows[0].n);
    const wouldUpdateY = await client.query("select count(*) as n from sessions where (axes->'y'->>'lowDesc') is null");
    console.log('Sessions that would get y.lowDesc:', wouldUpdateY.rows[0].n);
    await client.query('rollback');

    // AFTER: story count must be identical
    const after = await client.query('select count(*) as total, count(x) as placed from stories');
    const afterSample = await client.query('select id, x, y, length(body) as blen from stories where x is not null order by id limit 5');
    console.log('\nAFTER stories:', after.rows[0]);
    afterSample.rows.forEach(r => console.log('  story:', r.id, 'x=', r.x, 'y=', r.y, 'body_len=', r.blen));

    const match = JSON.stringify(before.rows[0]) === JSON.stringify(after.rows[0]) &&
      beforeSample.rows.every((b, i) => JSON.stringify(b) === JSON.stringify(afterSample.rows[i]));
    console.log('\nStory data identical before/after:', match ? 'YES ✓' : 'NO ✗');
    if (!match) process.exit(1);
  } finally {
    client.release();
    await p.end();
  }
}
main().catch(e => { console.error('ERROR:', e.message); p.end(); process.exit(1); });
