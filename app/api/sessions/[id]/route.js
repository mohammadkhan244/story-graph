import { NextResponse } from 'next/server';
import { q, publicSession, publicPoints, mapFields } from '@/lib/db';
import { fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const out = { session: publicSession(s), map: null };
    if (s.published || s.is_default) {
      const stories = await q('select * from stories where session_id=$1 order by created_at', [s.id]);
      out.map = { ...mapFields(s), points: publicPoints(s, stories) };
    }
    return NextResponse.json(out);
  } catch (e) { return fail(e); }
}
