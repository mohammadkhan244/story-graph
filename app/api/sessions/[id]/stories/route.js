import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { q } from '@/lib/db';
import { fail } from '@/lib/auth';
import { readStory, invalid, saveAndPlace, sessionMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GRACE_MS = 90 * 1000;

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    if (b.website) return NextResponse.json({ ok: true }); // honeypot
    const st = readStory(b);
    const bad = invalid(st);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const s = (await q('select * from sessions where id=$1', [params.id]))[0];
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const late = s.ends_at && Date.now() > new Date(s.ends_at).getTime() + GRACE_MS;
    if (s.status !== 'open' || late) return NextResponse.json({ error: 'This session is closed.' }, { status: 403 });
    const isTest = cookies().get('sm_test')?.value === '1';
    const { story, token, warning } = await saveAndPlace(s, { ...st, isTest });
    const map = s.is_default || s.published ? await sessionMap(s, false) : null;
    return NextResponse.json({ story, token, map, warning });
  } catch (e) { return fail(e); }
}
