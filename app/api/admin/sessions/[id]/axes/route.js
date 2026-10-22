import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { proposeAxes } from '@/lib/claude';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const stories = await q('select id, body from stories where session_id=$1 order by created_at', [s.id]);
    if (stories.length < 2) return NextResponse.json({ error: 'Need at least two stories to find axes.' }, { status: 400 });
    const { cands, pair } = await proposeAxes(s.prompt, stories);
    await q('update sessions set cands=$2 where id=$1', [s.id, JSON.stringify(cands)]);
    return NextResponse.json({ cands, pair });
  } catch (e) { return fail(e); }
}
