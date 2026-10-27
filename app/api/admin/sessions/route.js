import { NextResponse } from 'next/server';
import { q, newId } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) return denied();
  try {
    const rows = await q(
      `select s.id, s.title, s.is_default, s.status, s.published, s.ends_at, s.created_at,
         s.kind, s.slug, s.big_question, s.year, s.sort, s.hidden,
         (select count(*)::int from stories t where t.session_id=s.id) as n
       from sessions s
       order by (s.kind='open') desc, s.sort asc, s.is_default desc, s.created_at desc`
    );
    return NextResponse.json({ sessions: rows });
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));

    /* Create session from an existing open prompt */
    if (b.fromPromptId) {
      const pr = (await q('select * from sessions where id=$1', [b.fromPromptId]))[0];
      if (!pr) return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 });
      const id = newId(8);
      const title = String(b.title || pr.title).trim().slice(0, 120) || pr.title;
      const minutes = Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10));
      await q(
        `insert into sessions (id,title,prompt,signals,minutes,status,axes,kind,big_question,instructions,year,parent_id,ask,scene,label_mode)
         values ($1,$2,$3,$4,$5,'closed',$6,'session',$7,$8,$9,$10,$11,$12,'anon')`,
        [id, title, pr.prompt, JSON.stringify(pr.signals), minutes,
         pr.axes ? JSON.stringify(pr.axes) : null,
         pr.big_question || '', pr.instructions || '', pr.year || null,
         pr.id, pr.ask ? JSON.stringify(pr.ask) : null, pr.scene || '']
      );
      return NextResponse.json({ id });
    }

    /* Standard new session */
    const title = String(b.title || '').trim().slice(0, 120) || 'Untitled session';
    const prompt = String(b.prompt || '').trim().slice(0, 2000);
    if (!prompt) return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    const signals = cleanSignals(b.signals);
    const minutes = Math.max(1, Math.min(120, parseInt(b.minutes, 10) || 10));
    const id = newId(8);
    await q(
      `insert into sessions (id,title,prompt,signals,minutes,status,kind) values ($1,$2,$3,$4,$5,'closed','session')`,
      [id, title, prompt, JSON.stringify(signals), minutes]
    );
    return NextResponse.json({ id });
  } catch (e) { return fail(e); }
}

function cleanSignals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (typeof x === 'string') return x.trim().slice(0, 80);
    if (x && typeof x === 'object') return { type: String(x.type || '').trim().slice(0, 40), text: String(x.text || '').trim().slice(0, 400) };
    return null;
  }).filter(Boolean).slice(0, 12);
}
