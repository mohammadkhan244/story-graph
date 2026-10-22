import { NextResponse } from 'next/server';
import { q, newId } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) return denied();
  try {
    const rows = await q(
      `select s.id, s.title, s.is_default, s.status, s.published, s.ends_at, s.created_at,
        (select count(*)::int from stories t where t.session_id=s.id) as n
       from sessions s order by s.is_default desc, s.created_at desc`
    );
    return NextResponse.json({ sessions: rows });
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || '').trim().slice(0, 120) || 'Untitled session';
    const prompt = String(b.prompt || '').trim().slice(0, 2000);
    if (!prompt) return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    const signals = (Array.isArray(b.signals) ? b.signals : []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 12);
    const minutes = Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10));
    const id = newId(8);
    await q(`insert into sessions (id,title,prompt,signals,minutes,status) values ($1,$2,$3,$4,$5,'closed')`, [id, title, prompt, JSON.stringify(signals), minutes]);
    return NextResponse.json({ id });
  } catch (e) { return fail(e); }
}
