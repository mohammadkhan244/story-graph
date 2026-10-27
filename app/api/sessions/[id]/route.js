import { NextResponse } from 'next/server';
import { q, publicSession } from '@/lib/db';
import { fail } from '@/lib/auth';
import { sessionMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const map = s.published || s.is_default ? await sessionMap(s, true) : null;
    const parent = s.parent_id ? (await q('select slug from sessions where id=$1', [s.parent_id]))[0] : null;
    return NextResponse.json({ session: { ...publicSession(s), cardSlug: (parent && parent.slug) || s.slug }, map });
  } catch (e) { return fail(e); }
}
