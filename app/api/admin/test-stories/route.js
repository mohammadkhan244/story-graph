import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req) {
  if (!isAdmin()) return denied();
  try {
    const sessionId = req.nextUrl.searchParams.get('session');
    const r = sessionId
      ? await q('delete from stories where is_test = true and session_id=$1 returning id', [sessionId])
      : await q('delete from stories where is_test = true returning id');
    return NextResponse.json({ deleted: r.length });
  } catch (e) { return fail(e); }
}
