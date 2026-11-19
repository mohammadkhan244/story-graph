import { NextResponse } from 'next/server';
import { q, newId } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';
import { saveAndPlace } from '@/lib/submit';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const stories = (await q('select * from stories where session_id=$1 order by created_at', [s.id]))
      .map(({ reading: _r, token_hash: _t, ...rest }) => rest);
    return NextResponse.json({ session: s, stories });
  } catch (e) { return fail(e); }
}

const cleanAxis = (a) => a && typeof a === 'object'
  ? { name: String(a.name || '').slice(0, 80), low: String(a.low || '').slice(0, 80), high: String(a.high || '').slice(0, 80), why: String(a.why || '').slice(0, 400), lowDesc: String(a.lowDesc || '').slice(0, 300), highDesc: String(a.highDesc || '').slice(0, 300) }
  : null;

function cleanSignals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (typeof x === 'string') return x.trim().slice(0, 80);
    if (x && typeof x === 'object') return { type: String(x.type || '').trim().slice(0, 40), text: String(x.text || '').trim().slice(0, 400) };
    return null;
  }).filter(Boolean).slice(0, 12);
}

export async function PATCH(req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const set = [], vals = [s.id];
    const put = (col, v) => { vals.push(v); set.push(`${col}=$${vals.length}`); };

    if (typeof b.title === 'string') put('title', b.title.trim().slice(0, 120) || s.title);
    if (typeof b.prompt === 'string' && b.prompt.trim()) put('prompt', b.prompt.trim().slice(0, 2000));
    if (typeof b.big_question === 'string') put('big_question', b.big_question.trim().slice(0, 400));
    if (typeof b.instructions === 'string') put('instructions', b.instructions.trim().slice(0, 4000));
    if (b.year != null) put('year', parseInt(b.year, 10) || null);
    if (b.sort != null) put('sort', parseInt(b.sort, 10) || 999);
    if (typeof b.hidden === 'boolean') put('hidden', b.hidden);
    if (Array.isArray(b.signals)) put('signals', JSON.stringify(cleanSignals(b.signals)));
    if (b.minutes != null) put('minutes', Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10)));
    if (b.start) {
      const mins = b.minutes != null ? Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10)) : s.minutes;
      put('status', 'open'); put('ends_at', new Date(Date.now() + mins * 60000).toISOString());
      put('paused_at', null); put('remaining_seconds', null);
    }
    if (b.open) { put('status', 'open'); put('ends_at', null); put('paused_at', null); put('remaining_seconds', null); }
    if (b.stop) { put('status', 'closed'); put('ends_at', new Date().toISOString()); put('paused_at', null); put('remaining_seconds', null); }
    if (b.pause && s.ends_at && !s.paused_at) {
      const rem = Math.max(0, Math.floor((new Date(s.ends_at).getTime() - Date.now()) / 1000));
      put('paused_at', new Date().toISOString()); put('remaining_seconds', rem);
    }
    if (b.resume && s.paused_at) {
      const rem = s.remaining_seconds || 0;
      put('ends_at', new Date(Date.now() + rem * 1000).toISOString());
      put('paused_at', null); put('remaining_seconds', null);
    }
    if (b.restart) {
      const mins = s.minutes || 10;
      put('status', 'open'); put('ends_at', new Date(Date.now() + mins * 60000).toISOString());
      put('paused_at', null); put('remaining_seconds', null);
    }
    if (b.axes) {
      const x = cleanAxis(b.axes.x), y = cleanAxis(b.axes.y);
      if (x && y) put('axes', JSON.stringify({ x, y }));
    }
    if (typeof b.published === 'boolean') put('published', s.is_default ? true : b.published);
    if (b.label_mode === 'names' || b.label_mode === 'anon') put('label_mode', b.label_mode);
    if (typeof b.featured === 'boolean') put('featured', b.featured);
    if (typeof b.card_why === 'string') put('card_why', b.card_why.trim().slice(0, 400));
    if (typeof b.kind === 'string' && ['open', 'session', 'visitor'].includes(b.kind)) put('kind', b.kind);
    if (typeof b.slug === 'string') {
      const clean = b.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      put('slug', clean || null);
    }
    if (Array.isArray(b.rounds)) {
      const rounds = b.rounds.slice(0, 2).map((r) => ({
        label: String(r.label || '').trim().slice(0, 80),
        prompt: String(r.prompt || '').trim().slice(0, 2000),
      }));
      put('rounds', JSON.stringify(rounds.length ? rounds : null));
    }
    if (b.start_round2) {
      const mins = b.minutes != null ? Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10)) : s.minutes;
      put('current_round', 2);
      put('round2_at', new Date().toISOString());
      put('status', 'open');
      put('ends_at', new Date(Date.now() + mins * 60000).toISOString());
      put('paused_at', null);
      put('remaining_seconds', null);
    }

    let updated = s;
    if (set.length) {
      const r = await q(`update sessions set ${set.join(', ')} where id=$1 returning *`, vals);
      updated = r[0];
    }

    // Seed pair creation (requires axes to place stories)
    if (b.add_seed_pair) {
      const { name = '', r1 = '', r2 = '' } = b.add_seed_pair;
      const r1Body = String(r1).trim(), r2Body = String(r2).trim();
      if (r1Body && r2Body) {
        const pid = newId(12);
        const sess = updated;
        await saveAndPlace(sess, { body: r1Body, name: String(name).trim().slice(0, 60), signal: '', headline: '', context: '', shared: true, isTest: false, participantId: pid, round: 1 });
        await saveAndPlace(sess, { body: r2Body, name: String(name).trim().slice(0, 60), signal: '', headline: '', context: '', shared: true, isTest: false, participantId: pid, round: 2 });
      }
    }

    return NextResponse.json({ session: updated });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const s = (await q('select is_default, kind from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ ok: true });
    if (s.is_default) return NextResponse.json({ error: 'The default session cannot be deleted.' }, { status: 400 });
    await q('delete from sessions where id=$1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
