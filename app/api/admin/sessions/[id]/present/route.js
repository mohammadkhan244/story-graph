import { NextResponse } from 'next/server';
import { q, publicSession } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';
import { sessionMap, promptMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';

/* Presenter screen: every dot (names as typed), arrows, and earlier stories as background. */
export async function GET(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const map = s.kind === 'open' ? await promptMap(s) : await sessionMap({ ...s, label_mode: 'names' }, true);
    const total = (await q('select count(*)::int as n from stories where session_id=$1 and is_test=false', [s.id]))[0].n;
    return NextResponse.json({ session: publicSession(s), map, total });
  } catch (e) { return fail(e); }
}
