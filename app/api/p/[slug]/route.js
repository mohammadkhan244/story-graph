import { NextResponse } from 'next/server';
import { q, publicSession, publicPoints, mapFields } from '@/lib/db';
import { fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const s = (await q("select * from sessions where slug=$1 and kind='open'", [params.slug]))[0];
    if (!s) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    const stories = await q('select * from stories where session_id=$1 order by created_at', [s.id]);
    return NextResponse.json({
      session: publicSession(s),
      map: { ...mapFields(s), points: publicPoints(s, stories) },
    });
  } catch (e) { return fail(e); }
}
