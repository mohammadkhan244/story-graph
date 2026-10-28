import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    /* Open prompts for the menu (have a slug, not hidden, sorted) */
    const prompts = await q(
      `select s.id, s.title, s.slug, s.big_question, s.year, s.sort,
         (select count(*)::int from stories t where t.session_id=s.id and not t.is_test) as n
       from sessions s
       where s.kind='open' and s.slug is not null and not s.hidden
       order by s.sort asc, s.created_at asc`
    );

    /* Past shared sessions (kind='session' or legacy non-default) */
    const past = await q(
      `select s.id, s.title, s.prompt, s.created_at,
         (select count(*)::int from stories t where t.session_id=s.id and t.x is not null and not t.is_test) as n
       from sessions s
       where s.published and (s.kind='session' or (s.kind='open' and s.slug is null and not s.is_default))
         and not s.is_default
       order by s.created_at desc`
    );

    return NextResponse.json({ prompts, past });
  } catch (e) { return fail(e); }
}
