import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { fail } from '@/lib/auth';

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
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
