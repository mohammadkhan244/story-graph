import pg from 'pg';
import crypto from 'crypto';
import { seed } from './seed';

const SCHEMA = `
create table if not exists sessions (
  id text primary key,
  title text not null,
  prompt text not null,
  signals jsonb not null default '[]',
  minutes int not null default 10,
  is_default boolean not null default false,
  status text not null default 'open',
  ends_at timestamptz,
  axes jsonb,
  cands jsonb,
  quads jsonb,
  readout text,
  published boolean not null default false,
  label_mode text not null default 'anon',
  created_at timestamptz not null default now()
);
create table if not exists stories (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  name text not null default '',
  signal text not null default '',
  body text not null,
  x real, y real, ox real, oy real,
  xq text, yq text, xw text, yw text,
  moved boolean not null default false,
  source text not null default 'web',
  created_at timestamptz not null default now()
);
create index if not exists stories_session on stories(session_id);
`;

function url() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function pool() {
  const g = globalThis;
  if (!g.__smPool) {
    const u = url();
    if (!u) throw new Error('DATABASE_URL is not set');
    const local = /localhost|127\.0\.0\.1/.test(u);
    g.__smPool = new pg.Pool({ connectionString: u, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });
  }
  return g.__smPool;
}

let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      const p = pool();
      await p.query(SCHEMA);
      const r = await p.query('select count(*)::int as n from sessions');
      if (r.rows[0].n === 0) await seed(p);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function q(text, params) {
  await ensure();
  const r = await pool().query(text, params);
  return r.rows;
}

export function newId(len = 8) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += a[bytes[i] % a.length];
  return s;
}

/* Public shapes. Never expose more than these. */
export function publicSession(s) {
  return {
    id: s.id, title: s.title, prompt: s.prompt, signals: s.signals || [], minutes: s.minutes,
    isDefault: s.is_default, status: s.status, endsAt: s.ends_at, published: s.published,
  };
}

export function publicPoints(session, stories) {
  let n = 0;
  return stories
    .filter((s) => s.x != null && s.y != null)
    .map((s) => {
      n++;
      const label = session.is_default
        ? (s.name || '').trim() || 'Anonymous'
        : session.label_mode === 'names' ? ((s.name || '').trim() || 'Anonymous') : 'Story ' + n;
      return { id: s.id, label, signal: s.signal, x: s.x, y: s.y, xq: s.xq, yq: s.yq, xw: s.xw, yw: s.yw };
    });
}

export function mapFields(s) {
  return { axes: s.axes, quads: s.quads, readout: s.readout };
}
