import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const clamp = (v) => Math.max(-5, Math.min(5, Math.round((Number(v) || 0) * 10) / 10));

export async function PATCH(req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));
    if (b.arrow !== undefined || b.stays !== undefined) {
      if (b.stays) await q('update stories set ax=null, ay=null, stays=true where id=$1', [params.id]);
      else if (b.arrow) await q('update stories set ax=$2, ay=$3, stays=false where id=$1', [params.id, clamp(b.arrow.x), clamp(b.arrow.y)]);
      else await q('update stories set ax=null, ay=null, stays=false where id=$1', [params.id]);
      return NextResponse.json({ ok: true });
    }
    if (b.x == null || b.y == null) return NextResponse.json({ error: 'x and y are required' }, { status: 400 });
    const r = await q('update stories set x=$2, y=$3, moved=true where id=$1 returning id,x,y', [params.id, clamp(b.x), clamp(b.y)]);
    return NextResponse.json({ story: r[0] || null });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return denied();
  try {
    await q('delete from stories where id=$1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
