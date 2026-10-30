import { NextResponse } from 'next/server';
import { q, publicSession } from '@/lib/db';
import { fail } from '@/lib/auth';
import { promptMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    let s = (await q("select * from sessions where slug=$1 and kind='open'", [params.slug]))[0];
    if (!s) s = (await q("select * from sessions where id=$1 and kind='open'", [params.slug]))[0];
    if (!s) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    return NextResponse.json({ session: publicSession(s), map: await promptMap(s) });
  } catch (e) { return fail(e); }
}
