import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

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
    }
    if (b.open) { put('status', 'open'); put('ends_at', null); }
    if (b.stop) { put('status', 'closed'); put('ends_at', new Date().toISOString()); }
    if (b.axes) {
      const x = cleanAxis(b.axes.x), y = cleanAxis(b.axes.y);
      if (x && y) put('axes', JSON.stringify({ x, y }));
    }
    if (typeof b.published === 'boolean') put('published', s.is_default ? true : b.published);
    if (b.label_mode === 'names' || b.label_mode === 'anon') put('label_mode', b.label_mode);

    if (!set.length) return NextResponse.json({ session: s });
    const r = await q(`update sessions set ${set.join(', ')} where id=$1 returning *`, vals);
    return NextResponse.json({ session: r[0] });
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
