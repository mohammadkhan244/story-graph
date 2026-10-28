import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { q } from '@/lib/db';
import { fail } from '@/lib/auth';
import { readStory, invalid, saveAndPlace, promptMap } from '@/lib/submit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    if (b.website) return NextResponse.json({ ok: true }); // honeypot
    const st = readStory(b);
    const bad = invalid(st);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const s = (await q("select * from sessions where slug=$1 and kind='open'", [params.slug]))[0];
    if (!s) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    const isTest = cookies().get('sm_test')?.value === '1';
    const { story, token, warning } = await saveAndPlace(s, { ...st, isTest });
    return NextResponse.json({ story, token, map: await promptMap(s), warning });
  } catch (e) { return fail(e); }
}
