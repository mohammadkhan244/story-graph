import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { placeAll } from '@/lib/claude';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (!s.axes) return NextResponse.json({ error: 'Pick two axes first.' }, { status: 400 });
    const stories = await q('select id, body from stories where session_id=$1 order by created_at', [s.id]);
    if (!stories.length) return NextResponse.json({ error: 'No stories yet.' }, { status: 400 });
    const r = await placeAll(s.prompt, s.axes, stories);
    for (const [id, sc] of Object.entries(r.scores)) {
      await q('update stories set x=$2,y=$3,ox=$2,oy=$3,xq=$4,yq=$5,xw=$6,yw=$7,moved=false where id=$1', [id, sc.x, sc.y, sc.xq, sc.yq, sc.xw, sc.yw]);
    }
    await q('update sessions set quads=$2, readout=$3 where id=$1', [s.id, JSON.stringify(r.quads), r.readout]);
    return NextResponse.json({ placed: Object.keys(r.scores).length, total: stories.length });
  } catch (e) { return fail(e); }
}
