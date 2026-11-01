const pg = require('pg');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => { const [k, ...rest] = line.split('='); if (k && rest.length) process.env[k.trim()] = rest.join('=').trim().replace(/^"|"$/g, ''); });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }
const p = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
async function main() {
  const counts = await p.query('select count(*) as total, count(x) as placed from stories');
  console.log('STORIES:', counts.rows[0]);
  const sample = await p.query('select id, body, x, y from stories where x is not null order by created_at limit 3');
  sample.rows.forEach((r, i) => console.log(`SAMPLE[${i}] id=${r.id} x=${r.x} y=${r.y} body_chars=${r.body.length}`));
  const withDesc = await p.query("select count(*) as n from sessions where (axes->'x'->>'lowDesc') is not null");
  console.log('SESSIONS WITH X LOWDESC:', withDesc.rows[0].n);
  const meta = await p.query("select key from meta order by key");
  console.log('META KEYS:', meta.rows.map(r => r.key).join(', '));
}
main().then(() => p.end()).catch(e => { console.error('ERROR:', e.message); p.end(); process.exit(1); });
