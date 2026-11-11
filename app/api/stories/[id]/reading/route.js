import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { fail } from '@/lib/auth';
import { generateReading } from '@/lib/reading';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    const story = (await q('select * from stories where id=$1', [params.id]))[0];
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (!b.token || hashToken(b.token) !== story.token_hash) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const stage = ['early', 'mid', 'deep'].includes(b.stage) ? b.stage : 'early';
    const lens = String(b.lens || '').trim().slice(0, 200);

    const session = story.session_id
      ? (await q('select * from sessions where id=$1', [story.session_id]))[0]
      : null;

    const reading = await generateReading(story, session, { stage, lens });
    if (!reading) throw new Error('Could not generate reading');
    return NextResponse.json({ reading });
  } catch (e) { return fail(e); }
}
