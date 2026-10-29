import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { fail } from '@/lib/auth';
import { promptMap, sessionMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    let s = (await q('select * from sessions where id=$1', [id]))[0];
    if (!s) s = (await q('select * from sessions where slug=$1', [id]))[0];
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const map = s.kind === 'open'
      ? await promptMap(s)
      : await sessionMap(s, false);

    let ctaSlug = null;
    if (s.kind === 'open' && s.slug) {
      ctaSlug = s.slug;
    } else if (s.parent_id) {
      const parent = (await q('select slug from sessions where id=$1', [s.parent_id]))[0];
      if (parent && parent.slug) ctaSlug = parent.slug;
    }

    return NextResponse.json({
      title: s.title,
      bigQuestion: s.big_question || '',
      storyCount: map.points.length,
      ctaSlug,
      map,
    });
  } catch (e) { return fail(e); }
}
