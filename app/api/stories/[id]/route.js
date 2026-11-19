import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { fail } from '@/lib/auth';
import { compareRounds } from '@/lib/claude';

export const dynamic = 'force-dynamic';

const clamp = (v) => Math.max(-5, Math.min(5, Math.round((Number(v) || 0) * 10) / 10));

/* A writer sets (or clears) their own arrow, using the token they got on submit. */
export async function PATCH(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    if (!b.token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    const t = (await q('select id from stories where id=$1 and token_hash=$2', [params.id, hashToken(b.token)]))[0];
    if (!t) return NextResponse.json({ error: 'Not your story' }, { status: 403 });
    if (b.stays !== undefined || b.arrow !== undefined) {
      if (b.stays) {
        await q('update stories set ax=null, ay=null, stays=true where id=$1', [params.id]);
      } else if (b.arrow && b.arrow.x != null && b.arrow.y != null) {
        await q('update stories set ax=$2, ay=$3, stays=false where id=$1', [params.id, clamp(b.arrow.x), clamp(b.arrow.y)]);
      } else {
        await q('update stories set ax=null, ay=null, stays=false where id=$1', [params.id]);
      }
    }
    if (typeof b.shared === 'boolean') {
      await q('update stories set shared=$2 where id=$1', [params.id, b.shared]);
    }
    if (typeof b.arrow_effect === 'string' && ['Yes', 'A little', 'No'].includes(b.arrow_effect)) {
      await q('update stories set arrow_effect=$2 where id=$1', [params.id, b.arrow_effect]);
    }
    if (b.retry_flip) {
      const story = (await q('select * from stories where id=$1 and token_hash=$2', [params.id, hashToken(b.token)]))[0];
      if (story && !story.flip && story.participant_id) {
        const r1 = await q('select body from stories where session_id=$1 and participant_id=$2 and round=1 and id<>$3 limit 1',
          [story.session_id, story.participant_id, story.id]);
        if (r1.length > 0) {
          try {
            const flip = await compareRounds(r1[0].body, story.body);
            await q('update stories set flip=$2 where id=$1', [params.id, JSON.stringify(flip)]);
            return NextResponse.json({ ok: true, flip });
          } catch { return NextResponse.json({ ok: false, flip: null }); }
        }
      }
      return NextResponse.json({ ok: true, flip: story?.flip || null });
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
