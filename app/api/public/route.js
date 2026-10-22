import { NextResponse } from 'next/server';
import { q, publicSession, publicPoints, mapFields } from '@/lib/db';
import { fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const def = (await q('select * from sessions where is_default order by created_at limit 1'))[0];
    if (!def) return NextResponse.json({ error: 'No default session' }, { status: 404 });
    const stories = await q('select * from stories where session_id=$1 order by created_at', [def.id]);
    const past = await q(
      `select s.id, s.title, s.prompt, s.created_at,
        (select count(*)::int from stories t where t.session_id=s.id and t.x is not null) as n
       from sessions s where s.published and not s.is_default order by s.created_at desc`
    );
    return NextResponse.json({ session: publicSession(def), map: { ...mapFields(def), points: publicPoints(def, stories) }, past });
  } catch (e) { return fail(e); }
}
