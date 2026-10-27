import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { q } from '@/lib/db';
import { fail } from '@/lib/auth';
import { saveAndPlace } from '@/lib/submit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* The workshop site's 90-second card exercise sends stories here (server to server).
   They land on the matching decision map as hollow dots ("from the card exercise"). */
const DECISION = { migration: 'replace-a-system', automation: 'automate-a-process', buildbuy: 'build-or-buy', scaling: 'handle-more-demand' };

function authorized(req) {
  const want = process.env.INGEST_SECRET || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!want || !got) return false;
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    const slug = DECISION[b.decision] || (Object.values(DECISION).includes(b.decision) ? b.decision : null);
    if (!slug) return NextResponse.json({ error: 'Unknown decision' }, { status: 400 });
    const body = String(b.story || '').trim();
    if (body.length < 20 || body.length > 8000) return NextResponse.json({ error: 'Story length out of range' }, { status: 400 });
    const s = (await q("select * from sessions where slug=$1 and kind='open'", [slug]))[0];
    if (!s) return NextResponse.json({ error: 'Map not found' }, { status: 404 });
    const extId = String(b.submissionId || '').slice(0, 80);
    if (extId) {
      const dup = await q("select id from stories where session_id=$1 and context=$2 and source='card-exercise'", [s.id, 'ext:' + extId]);
      if (dup.length) return NextResponse.json({ ok: true, id: dup[0].id, duplicate: true });
    }
    const cards = [b.situation, b.character, b.emotion, b.lens].filter(Boolean).map(String).join(' | ').slice(0, 300);
    const { story } = await saveAndPlace(s, { body, name: '', signal: cards, headline: '', context: '', shared: false });
    await q("update stories set source='card-exercise', context=$2 where id=$1", [story.id, extId ? 'ext:' + extId : '']);
    return NextResponse.json({ ok: true, id: story.id });
  } catch (e) { return fail(e); }
}
