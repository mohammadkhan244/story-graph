import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { q } from '@/lib/db';
import { fail, isAdmin } from '@/lib/auth';
import { promptMap, sessionMap } from '@/lib/submit';
import { generateQuadrantMeanings } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    let s = (await q('select * from sessions where id=$1', [id]))[0];
    if (!s) s = (await q('select * from sessions where slug=$1', [id]))[0];
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const includeTest = isAdmin() && cookies().get('sm_test')?.value === '1';
    if (!s.quadrants && s.axes && s.quads) {
      try {
        const quadrants = await generateQuadrantMeanings(s.axes, s.quads);
        if (quadrants) {
          await q('update sessions set quadrants=$2 where id=$1', [s.id, JSON.stringify(quadrants)]);
          s = { ...s, quadrants };
        }
      } catch {}
    }
    const map = s.kind === 'open'
      ? await promptMap(s, includeTest)
      : await sessionMap(s, false, includeTest);

    let ctaSlug = s.slug || (['open', 'visitor', 'session'].includes(s.kind) ? s.id : null);
    if (s.parent_id) {
      const parent = (await q('select id, slug from sessions where id=$1', [s.parent_id]))[0];
      if (parent) ctaSlug = parent.slug || parent.id;
    }

    return NextResponse.json({
      title: s.title,
      bigQuestion: s.big_question || '',
      prompt: s.prompt || '',
      storyCount: map.points.length,
      ctaSlug,
      map,
      sessionRoles: Array.isArray(s.roles) ? s.roles : null,
    });
  } catch (e) { return fail(e); }
}
