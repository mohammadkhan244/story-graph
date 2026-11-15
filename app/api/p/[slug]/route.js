import { NextResponse } from 'next/server';
import { q, publicSession } from '@/lib/db';
import { fail } from '@/lib/auth';
import { promptMap } from '@/lib/submit';
import { generateQuadrantMeanings } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    let s = (await q("select * from sessions where slug=$1 and kind in ('open','visitor','session')", [params.slug]))[0];
    if (!s) s = (await q("select * from sessions where id=$1 and kind in ('open','visitor','session')", [params.slug]))[0];
    if (!s) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    if (!s.quadrants && s.axes && s.quads) {
      try {
        const quadrants = await generateQuadrantMeanings(s.axes, s.quads);
        if (quadrants) {
          await q('update sessions set quadrants=$2 where id=$1', [s.id, JSON.stringify(quadrants)]);
          s = { ...s, quadrants };
        }
      } catch {}
    }
    return NextResponse.json({ session: publicSession(s), map: await promptMap(s) });
  } catch (e) { return fail(e); }
}
