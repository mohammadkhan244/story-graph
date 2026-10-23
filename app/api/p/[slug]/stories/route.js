import { NextResponse } from 'next/server';
import { q, newId, publicPoints, mapFields } from '@/lib/db';
import { placeOne } from '@/lib/claude';
import { fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    if (b.website) return NextResponse.json({ ok: true }); // honeypot
    const body = String(b.text || '').trim();
    const name = String(b.name || '').trim().slice(0, 60);
    const signal = String(b.signal || '').trim().slice(0, 80);
    const headline = String(b.headline || '').trim().slice(0, 120);
    if (body.length < 20) return NextResponse.json({ error: 'Write a little more before submitting.' }, { status: 400 });
    if (body.length > 8000) return NextResponse.json({ error: 'That story is too long (8,000 characters max).' }, { status: 400 });

    const s = (await q("select * from sessions where slug=$1 and kind='open'", [params.slug]))[0];
    if (!s) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });

    const id = newId(12);
    await q('insert into stories (id,session_id,name,signal,body,headline) values ($1,$2,$3,$4,$5,$6)',
      [id, s.id, name, signal, body, headline]);
    const story = { id, name, signal, headline, body, x: null, y: null };

    let warning = null;
    if (s.axes) {
      try {
        const anchors = await q(
          'select body,x,y from stories where session_id=$1 and x is not null and id<>$2 order by created_at desc limit 8',
          [s.id, id]
        );
        const promptCtx = signal ? `${s.prompt}\n\nSignal the writer chose: ${signal}` : s.prompt;
        const sc = await placeOne(promptCtx, s.axes, story, anchors);
        await q('update stories set x=$2,y=$3,ox=$2,oy=$3,xq=$4,yq=$5,xw=$6,yw=$7 where id=$1',
          [id, sc.x, sc.y, sc.xq, sc.yq, sc.xw, sc.yw]);
        Object.assign(story, sc);
      } catch (e) {
        console.error(e);
        warning = 'Your story is saved, but placing it on the map failed.';
      }
    }

    const all = await q('select * from stories where session_id=$1 order by created_at', [s.id]);
    const map = { ...mapFields(s), points: publicPoints(s, all) };
    return NextResponse.json({ story, map, warning });
  } catch (e) { return fail(e); }
}
