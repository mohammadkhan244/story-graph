import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const clamp = (v) => Math.max(-5, Math.min(5, Math.round((Number(v) || 0) * 10) / 10));

export async function PATCH(req, { params }) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));
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
